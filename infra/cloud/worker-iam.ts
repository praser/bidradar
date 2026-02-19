/// <reference path="../../.sst/platform/config.d.ts" />

// ---------------------------------------------------------------------------
// IAM Group — bidradar-worker (S3, SSM, SQS full access)
// ---------------------------------------------------------------------------

const workerGroup = new aws.iam.Group("WorkerGroup", {
  name: `bidradar-worker-${$app.stage}`,
});

new aws.iam.GroupPolicyAttachment("WorkerS3Access", {
  group: workerGroup.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonS3FullAccess",
});

new aws.iam.GroupPolicyAttachment("WorkerSsmAccess", {
  group: workerGroup.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSSMFullAccess",
});

new aws.iam.GroupPolicyAttachment("WorkerSqsAccess", {
  group: workerGroup.name,
  policyArn: "arn:aws:iam::aws:policy/AmazonSQSFullAccess",
});

const workerUser = new aws.iam.User("WorkerUser", {
  name: `bidrdadar-worker-user-${$app.stage}`,
});

new aws.iam.UserGroupMembership("WorkerUserGroupMembership", {
  user: workerUser.name,
  groups: [workerGroup.name],
});