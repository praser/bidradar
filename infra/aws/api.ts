/// <reference path="../../.sst/platform/config.d.ts" />

export const bucket = new sst.aws.Bucket("DownloadsBucket", {
  transform: {
    bucket: { bucket: `bidradar-${$app.stage}-downloads` },
  },
});

export const secrets = {
  DATABASE_URL: new sst.Secret("DatabaseUrl", process.env.DATABASE_URL),
  JWT_SECRET: new sst.Secret("JwtSecret", process.env.JWT_SECRET),
  GOOGLE_CLIENT_ID: new sst.Secret("GoogleClientId", process.env.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: new sst.Secret("GoogleClientSecret", process.env.GOOGLE_CLIENT_SECRET),
  ADMIN_EMAILS: new sst.Secret("AdminEmails", process.env.ADMIN_EMAILS),

};

const api = new sst.aws.Function("Api", {
  handler: "apps/api/src/lambda.handler",
  runtime: "nodejs22.x",
  timeout: "3 minutes",
  memory: "512 MB",
  url: true,
  link: [...Object.values(secrets), bucket],
  environment: {
    DATABASE_URL: secrets.DATABASE_URL.value,
    JWT_SECRET: secrets.JWT_SECRET.value,
    GOOGLE_CLIENT_ID: secrets.GOOGLE_CLIENT_ID.value,
    GOOGLE_CLIENT_SECRET: secrets.GOOGLE_CLIENT_SECRET.value,
    ADMIN_EMAILS: secrets.ADMIN_EMAILS.value,
    BUCKET_NAME: bucket.name,
  },
  transform: {
    function: { name: `bidradar-${$app.stage}-api` },
  },
});

// Required for the Lambda function URL to accept public HTTP requests.
// SST creates the function URL with AuthorizationType=NONE but does not add the
// resource-based policy. Without this permission the URL returns 403 Forbidden.
// DO NOT REMOVE — see CLAUDE.md for details.
new aws.lambda.Permission("ApiPublicInvoke", {
  function: api.name,
  action: "lambda:InvokeFunction",
  principal: "*",
});

// ---------------------------------------------------------------------------
// SSM Parameters — env vars for apps and tools to discover at runtime
// ---------------------------------------------------------------------------

new aws.ssm.Parameter("SsmEnvDatabaseUrl", {
  name: `/bidradar/${$app.stage}/env/DATABASE_URL`,
  type: "SecureString",
  value: secrets.DATABASE_URL.value,
});

new aws.ssm.Parameter("SsmEnvJwtSecret", {
  name: `/bidradar/${$app.stage}/env/JWT_SECRET`,
  type: "SecureString",
  value: secrets.JWT_SECRET.value,
});

new aws.ssm.Parameter("SsmEnvGoogleClientId", {
  name: `/bidradar/${$app.stage}/env/GOOGLE_CLIENT_ID`,
  type: "String",
  value: secrets.GOOGLE_CLIENT_ID.value,
});

new aws.ssm.Parameter("SsmEnvGoogleClientSecret", {
  name: `/bidradar/${$app.stage}/env/GOOGLE_CLIENT_SECRET`,
  type: "SecureString",
  value: secrets.GOOGLE_CLIENT_SECRET.value,
});

new aws.ssm.Parameter("SsmEnvAdminEmails", {
  name: `/bidradar/${$app.stage}/env/ADMIN_EMAILS`,
  type: "String",
  value: secrets.ADMIN_EMAILS.value,
});

new aws.ssm.Parameter("SsmEnvBucketName", {
  name: `/bidradar/${$app.stage}/env/BUCKET_NAME`,
  type: "String",
  value: bucket.name,
});

new aws.ssm.Parameter("SsmEnvBidradarApiUrl", {
  name: `/bidradar/${$app.stage}/env/BIDRADAR_API_URL`,
  type: "String",
  value: api.url,
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const apiUrl = api.url;
export const apiName = api.name;
