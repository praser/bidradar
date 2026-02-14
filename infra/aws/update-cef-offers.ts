/// <reference path="../../.sst/platform/config.d.ts" />

import { bucket, secrets } from "./api.js";

new sst.aws.Cron("DownloadCefOffers", {
  schedule: "cron(0 10 * * ? *)",
  job: {
    handler: "apps/cef-lambdas/src/download-offers.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    link: [bucket],
    environment: {
      BUCKET_NAME: bucket.name,
    },
  },
});

bucket.subscribe(
  {
    handler: "apps/cef-lambdas/src/process-offers.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    link: [bucket, secrets.DATABASE_URL],
    environment: {
      DATABASE_URL: secrets.DATABASE_URL.value,
      BUCKET_NAME: bucket.name,
    },
  },
  {
    events: ["s3:ObjectCreated:*"],
    filterPrefix: "cef-downloads/offer-list/",
    filterSuffix: ".csv",
  },
);
