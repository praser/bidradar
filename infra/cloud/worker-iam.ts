/// <reference path="../../.sst/platform/config.d.ts" />

// ---------------------------------------------------------------------------
// IAM Group — bidradar-worker (scoped S3, SSM, SQS access)
// ---------------------------------------------------------------------------

const workerGroup = new aws.iam.Group("WorkerGroup", {
  name: `bidradar-worker-${$app.stage}`,
});

new aws.iam.GroupPolicy("WorkerS3Policy", {
  group: workerGroup.name,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:ListObjectsV2",
        ],
        Resource: "*",
      },
    ],
  }),
});

new aws.iam.GroupPolicy("WorkerSsmPolicy", {
  group: workerGroup.name,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "ssm:GetParametersByPath",
          "ssm:GetParameter",
          "ssm:GetParameters",
        ],
        Resource: "*",
      },
    ],
  }),
});

new aws.iam.GroupPolicy("WorkerSqsPolicy", {
  group: workerGroup.name,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility",
        ],
        Resource: "*",
      },
    ],
  }),
});

const workerUser = new aws.iam.User("WorkerUser", {
  name: `bidradar-worker-user-${$app.stage}`,
});

new aws.iam.UserGroupMembership("WorkerUserGroupMembership", {
  user: workerUser.name,
  groups: [workerGroup.name],
});
