/// <reference path="../../.sst/platform/config.d.ts" />

import { bucket, secrets } from "./api.js";

// Dead-letter queue for messages that fail processing after 3 attempts
const dlq = new sst.aws.Queue("CefDownloadDLQ", {
  visibilityTimeout: "11 minutes",
});

const queue = new sst.aws.Queue("CefDownloadQueue", {
  visibilityTimeout: "11 minutes",
  dlq: dlq.arn,
  transform: {
    queue: {
      redrivePolicy: $jsonStringify({
        deadLetterTargetArn: dlq.arn,
        maxReceiveCount: 3,
      }),
    },
  },
});

// ---------------------------------------------------------------------------
// SSM Parameters — queue URLs for the worker
// ---------------------------------------------------------------------------
if ($app.stage === "production") {
  new aws.ssm.Parameter("SsmDevSqsQueueUrl", {
    name: "/bidradar/dev/sqs-queue-url",
    type: "String",
    value: queue.url,
  });
} else {
  new aws.ssm.Parameter("SsmSqsQueueUrl", {
    name: `/bidradar/${$app.stage}/sqs-queue-url`,
    type: "String",
    value: queue.url,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const queueUrl = queue.url;
export const dlqUrl = dlq.url;
