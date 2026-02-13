/// <reference path="../../.sst/platform/config.d.ts" />

const secrets = {
  DATABASE_URL: new sst.Secret("DatabaseUrl", process.env.DATABASE_URL),
  JWT_SECRET: new sst.Secret("JwtSecret", process.env.JWT_SECRET),
  GOOGLE_CLIENT_ID: new sst.Secret("GoogleClientId", process.env.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: new sst.Secret("GoogleClientSecret", process.env.GOOGLE_CLIENT_SECRET),
  ADMIN_EMAILS: new sst.Secret("AdminEmails", process.env.ADMIN_EMAILS),
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

// ---------------------------------------------------------------------------
// Dual environments via Lambda aliases (dev / prod)
// ---------------------------------------------------------------------------
// - `dev` alias always points to $LATEST (updated on every deploy)
// - `prod` alias initially points to $LATEST; CI promotes it to a published
//   version after tests pass (via `aws lambda publish-version` +
//   `aws lambda update-alias`)
// - Each alias has its own function URL and invoke permission
// ---------------------------------------------------------------------------

// Dev alias — always tracks $LATEST
const devAlias = new aws.lambda.Alias("ApiDevAlias", {
  name: "dev",
  functionName: api.name,
  functionVersion: "$LATEST",
});

const devUrl = new aws.lambda.FunctionUrl("ApiDevUrl", {
  functionName: api.name,
  qualifier: "dev",
  authorizationType: "NONE",
}, { dependsOn: [devAlias] });

new aws.lambda.Permission("ApiDevInvoke", {
  function: api.name,
  action: "lambda:InvokeFunction",
  principal: "*",
  qualifier: "dev",
}, { dependsOn: [devAlias] });

// Prod alias — starts at $LATEST, CI updates to a published version
const prodAlias = new aws.lambda.Alias("ApiProdAlias", {
  name: "prod",
  functionName: api.name,
  functionVersion: "$LATEST",
});

const prodUrl = new aws.lambda.FunctionUrl("ApiProdUrl", {
  functionName: api.name,
  qualifier: "prod",
  authorizationType: "NONE",
}, { dependsOn: [prodAlias] });

new aws.lambda.Permission("ApiProdInvoke", {
  function: api.name,
  action: "lambda:InvokeFunction",
  principal: "*",
  qualifier: "prod",
}, { dependsOn: [prodAlias] });

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
// `apiUrl` — the default SST function URL (backwards compatible)
// `devApiUrl` — dev alias function URL
// `prodApiUrl` — prod alias function URL
// `apiName` — Lambda function name (needed by CI for version publishing)
// ---------------------------------------------------------------------------

export const apiUrl = api.url;
export const devApiUrl = devUrl.functionUrl;
export const prodApiUrl = prodUrl.functionUrl;
export const apiName = api.name;
