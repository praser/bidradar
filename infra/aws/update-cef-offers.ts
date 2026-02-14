/// <reference path="../../.sst/platform/config.d.ts" />

import { secrets } from "./api.js";

const bucket = new sst.aws.Bucket("CefDownloads");

new sst.aws.Cron("UpdateCefOffers", {
  schedule: "cron(0 10 * * ? *)",
  job: {
    handler: "apps/cef-lambdas/src/update-offers.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    link: [bucket, secrets.DATABASE_URL],
    environment: {
      DATABASE_URL: secrets.DATABASE_URL.value,
      BUCKET_NAME: bucket.name,
    },
  },
});

export { bucket };
