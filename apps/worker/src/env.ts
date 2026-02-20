import { hostname } from 'node:os'
import { z } from 'zod'

const EnvSchema = z.object({
  SQS_QUEUE_URL: z.url(),
  BUCKET_NAME: z.string(),
  BIDRADAR_API_URL: z.url(),
  BIDRADAR_API_KEY: z.string(),

  WORKER_ID: z.string().default(hostname()),
  RATE_LIMIT_DELAY_MS: z.coerce.number().default(1000),
  LOG_LEVEL: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).default('INFO'),
  AWS_REGION: z.string().default('us-east-1'),
})

export type Env = z.infer<typeof EnvSchema>

export async function loadEnv(): Promise<Env> {
  if (!process.env.SQS_QUEUE_URL) {
    const stage = process.env.BIDRADAR_ENV ?? 'local'
    const prefix = `/bidradar/${stage}/env/`

    const { SSMClient, GetParametersByPathCommand } = await import(
      '@aws-sdk/client-ssm'
    )

    const ssm = new SSMClient()
    let nextToken: string | undefined

    do {
      const result = await ssm.send(
        new GetParametersByPathCommand({
          Path: prefix,
          WithDecryption: true,
          NextToken: nextToken,
        }),
      )

      for (const param of result.Parameters ?? []) {
        const key = param.Name!.slice(prefix.length)
        if (!(key in process.env)) {
          process.env[key] = param.Value
        }
      }

      nextToken = result.NextToken
    } while (nextToken)
  }

  return EnvSchema.parse(process.env)
}
