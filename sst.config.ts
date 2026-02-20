/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const protectedStages = ["staging", "prod"];
    return {
      name: "bidradar",
      home: "aws",
      removal: protectedStages.includes(input.stage) ? "retain" : "remove",
    };
  },
  async run() {
    await import("./infra/cloud/api");
    await import("./infra/cloud/update-cef-offers");
    await import("./infra/cloud/worker-iam");
  },
});
