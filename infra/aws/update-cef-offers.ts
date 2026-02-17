/// <reference path="../../.sst/platform/config.d.ts" />

import { bucket, secrets } from "./api.js";

const queue = new sst.aws.Queue("CefDownloadQueue", {
  visibilityTimeout: "11 minutes",
});

queue.subscribe(
  {
    handler: "apps/cef-lambdas/src/download-file.handler",
    runtime: "nodejs22.x",
    architecture: "x86_64",
    timeout: "10 minutes",
    memory: "2048 MB",
    nodejs: {
      install: ["puppeteer-core", "@sparticuz/chromium"],
    },
    link: [bucket, secrets.ZYTE_API_KEY, secrets.DATABASE_URL],
    environment: {
      BUCKET_NAME: bucket.name,
      ZYTE_API_KEY: secrets.ZYTE_API_KEY.value,
      DATABASE_URL: secrets.DATABASE_URL.value,
    },
  },
  {
    batch: {
      size: 1,
    },
  },
);

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
