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

export function loadEnv(): Env {
  return envSchema.parse(process.env)
}
