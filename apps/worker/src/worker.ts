import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs'
import type { Env } from './env.js'
import type { Logger } from './logger.js'
import { processMessage } from './process-message.js'
import { createS3FileStore } from './s3-file-store.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffWithJitter(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 60_000)
  return base + Math.random() * base * 0.5
}

export function startWorker(env: Env, logger: Logger): { stop: () => void } {
  const sqs = new SQSClient({ region: env.AWS_REGION })
  const fileStore = createS3FileStore(env.BUCKET_NAME)
  let running = true
  let retryAttempt = 0

  async function poll(): Promise<void> {
    while (running) {
      try {
        const result = await sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: env.SQS_QUEUE_URL,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
          }),
        )

        const messages = result.Messages ?? []
        if (messages.length === 0) {
          continue
        }

        const message = messages[0]!
        logger.info('Received message', { messageId: message.MessageId })

        try {
          const base = {
            messageBody: message.Body!,
            bucketName: env.BUCKET_NAME,
            apiUrl: env.BIDRADAR_API_URL,
            apiKey: env.BIDRADAR_API_KEY,
            fileStore,
            logger,
          }
          await processMessage(base)

          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: env.SQS_QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle!,
            }),
          )

          retryAttempt = 0
          logger.info('Message processed successfully', { messageId: message.MessageId })

          if (running && env.RATE_LIMIT_DELAY_MS > 0) {
            await sleep(env.RATE_LIMIT_DELAY_MS)
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          const status = errMsg.match(/(\d{3})/)?.[1]

          if (status === '429' || status === '503') {
            const delay = backoffWithJitter(retryAttempt)
            retryAttempt++
            logger.warn('Rate limited, backing off', {
              messageId: message.MessageId,
              delay,
              attempt: retryAttempt,
              error: errMsg,
            })
            await sleep(delay)
          } else {
            retryAttempt = 0
            logger.error('Failed to process message (will be re-delivered by SQS)', {
              messageId: message.MessageId,
              error: errMsg,
            })
          }
        }
      } catch (err) {
        logger.error('SQS polling error', {
          error: err instanceof Error ? err.message : String(err),
        })
        await sleep(5000)
      }
    }
  }

  poll().catch((err) => {
    logger.error('Worker loop crashed', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return {
    stop() {
      running = false
    },
  }
}
