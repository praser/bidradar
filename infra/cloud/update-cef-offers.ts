/// <reference path="../../.sst/platform/config.d.ts" />

// ---------------------------------------------------------------------------
// SQS Queues — CEF download processing
// ---------------------------------------------------------------------------

function createQueuePair(env: string) {
  const id = env.charAt(0).toUpperCase() + env.slice(1);
  const physicalName = env.toLowerCase();

  const dlq = new sst.aws.Queue(`CefDownload${id}Dlq`, {
    visibilityTimeout: "11 minutes",
    transform: {
      queue: { name: `bidradar-${physicalName}-cef-download-dlq` },
    },
  });

  const queue = new sst.aws.Queue(`CefDownload${id}Queue`, {
    visibilityTimeout: "11 minutes",
    dlq: dlq.arn,
    transform: {
      queue: {
        name: `bidradar-${physicalName}-cef-download`,
        redrivePolicy: $jsonStringify({
          deadLetterTargetArn: dlq.arn,
          maxReceiveCount: 3,
        }),
      },
    },
  });

  return { queue, dlq };
}

// ---------------------------------------------------------------------------
// SSM Parameter — queue URL for the worker
// ---------------------------------------------------------------------------

const { queue } = createQueuePair($app.stage);

new aws.ssm.Parameter("SsmEnvSqsQueueUrl", {
  name: `/bidradar/${$app.stage}/env/SQS_QUEUE_URL`,
  type: "String",
  value: queue.url,
});

// ---------------------------------------------------------------------------
// EventBridge — hourly CEF file download schedule
// ---------------------------------------------------------------------------

const cefDownloadMessages = [
  {
    id: "OfferList",
    body: JSON.stringify({
      url: "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv",
      uf: "geral",
      fileType: "offer-list",
    }),
  },
  {
    id: "AuctionsSchedule",
    body: JSON.stringify({
      url: "https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/calendario-leiloes-imoveis-caixa.pdf",
      fileType: "auctions-schedule",
    }),
  },
  {
    id: "LicensedBrokers",
    body: JSON.stringify({
      url: "https://venda-imoveis.caixa.gov.br/listaweb/lista_corretores.zip",
      fileType: "licensed-brokers",
    }),
  },
  {
    id: "AccreditedAuctioneers",
    body: JSON.stringify({
      url: "https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/Relacao_Leiloeiros.pdf",
      fileType: "accredited-auctioneers",
    }),
  },
];

const hourlySchedule = new aws.cloudwatch.EventRule(
  "CefDownloadHourlySchedule",
  {
    name: `bidradar-${$app.stage}-cef-download-hourly`,
    description: "Triggers CEF file downloads every hour",
    scheduleExpression: "rate(1 hour)",
  },
);

new aws.sqs.QueuePolicy("CefDownloadQueuePolicy", {
  queueUrl: queue.url,
  policy: $resolve([queue.arn, hourlySchedule.arn]).apply(
    ([queueArn, ruleArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowEventBridgeSendMessage",
            Effect: "Allow",
            Principal: { Service: "events.amazonaws.com" },
            Action: "sqs:SendMessage",
            Resource: queueArn,
            Condition: { ArnEquals: { "aws:SourceArn": ruleArn } },
          },
        ],
      }),
  ),
});

for (const msg of cefDownloadMessages) {
  new aws.cloudwatch.EventTarget(`CefDownloadTarget${msg.id}`, {
    rule: hourlySchedule.name,
    targetId: `cef-download-${msg.id}`,
    arn: queue.arn,
    input: msg.body,
  });
}
