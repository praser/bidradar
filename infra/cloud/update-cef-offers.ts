/// <reference path="../../.sst/platform/config.d.ts" />

// ---------------------------------------------------------------------------
// SQS Queues — CEF download processing
// ---------------------------------------------------------------------------

function createQueuePair(env: string) {
  const id = env.charAt(0).toUpperCase() + env.slice(1);
  const physicalName = env.toLowerCase();

  const dlq = new sst.aws.Queue(`CefDownload${id}Dlq`, {
    visibilityTimeout: "11 minutes",
    transform: {
      queue: { name: `bidradar-${physicalName}-cef-download-dlq` },
    },
  });

  const queue = new sst.aws.Queue(`CefDownload${id}Queue`, {
    visibilityTimeout: "11 minutes",
    dlq: dlq.arn,
    transform: {
      queue: {
        name: `bidradar-${physicalName}-cef-download`,
        redrivePolicy: $jsonStringify({
          deadLetterTargetArn: dlq.arn,
          maxReceiveCount: 3,
        }),
      },
    },
  });

  return { queue, dlq };
}

// ---------------------------------------------------------------------------
// SSM Parameter — queue URL for the worker
// ---------------------------------------------------------------------------

const { queue } = createQueuePair($app.stage);

new aws.ssm.Parameter("SsmEnvSqsQueueUrl", {
  name: `/bidradar/${$app.stage}/env/SQS_QUEUE_URL`,
  type: "String",
  value: queue.url,
});
