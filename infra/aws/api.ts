const secrets = {
  DATABASE_URL: new sst.Secret("DatabaseUrl"),
  JWT_SECRET: new sst.Secret("JwtSecret"),
  GOOGLE_CLIENT_ID: new sst.Secret("GoogleClientId"),
  GOOGLE_CLIENT_SECRET: new sst.Secret("GoogleClientSecret"),
  ADMIN_EMAILS: new sst.Secret("AdminEmails"),
};

const api = new sst.aws.Function("Api", {
  handler: "apps/api/src/lambda.handler",
  runtime: "nodejs22.x",
  url: true,
  link: Object.values(secrets),
  environment: {
    DATABASE_URL: secrets.DATABASE_URL.value,
    JWT_SECRET: secrets.JWT_SECRET.value,
    GOOGLE_CLIENT_ID: secrets.GOOGLE_CLIENT_ID.value,
    GOOGLE_CLIENT_SECRET: secrets.GOOGLE_CLIENT_SECRET.value,
    ADMIN_EMAILS: secrets.ADMIN_EMAILS.value,
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

export const apiUrl = api.url;
