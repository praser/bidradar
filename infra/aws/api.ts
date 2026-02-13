const secrets = {
  DATABASE_URL: new sst.Secret("DatabaseUrl"),
  JWT_SECRET: new sst.Secret("JwtSecret"),
  GOOGLE_CLIENT_ID: new sst.Secret("GoogleClientId"),
  GOOGLE_CLIENT_SECRET: new sst.Secret("GoogleClientSecret"),
  ADMIN_EMAILS: new sst.Secret("AdminEmails"),
  ALLOWED_ORIGINS: new sst.Secret("AllowedOrigins"),
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
    ALLOWED_ORIGINS: secrets.ALLOWED_ORIGINS.value,
  },
});

export const apiUrl = api.url;
