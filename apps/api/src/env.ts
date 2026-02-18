import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://imoveis:imoveis@localhost:5432/imoveis'),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine((s) => !s.startsWith('change-me'), {
      message: 'JWT_SECRET must be changed from the default placeholder value',
    }),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((s) => (s.length > 0 ? s.split(',').map((e) => e.trim()) : [])),
  BUCKET_NAME: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export async function loadEnv(): Promise<Env> {
  if (!process.env.DATABASE_URL) {
    const stage = process.env.BIDRADAR_ENV ?? 'local'
    const prefix = `/bidradar/${stage}/env/`

    const { SSMClient, GetParametersByPathCommand } = await import(
      '@aws-sdk/client-ssm'
    )

    const ssm = new SSMClient()
    let nextToken: string | undefined

    do {
      const result = await ssm.send(
        new GetParametersByPathCommand({
          Path: prefix,
          WithDecryption: true,
          NextToken: nextToken,
        }),
      )

      for (const param of result.Parameters ?? []) {
        const key = param.Name!.slice(prefix.length)
        if (!(key in process.env)) {
          process.env[key] = param.Value
        }
      }

      nextToken = result.NextToken
    } while (nextToken)
  }

  return envSchema.parse(process.env)
}
