import { handle } from 'hono/aws-lambda'
import { createApp } from './app.js'
import { loadEnv } from './env.js'

let cached: ReturnType<typeof handle>

async function getHandler() {
  if (!cached) {
    const env = await loadEnv()
    const app = createApp(env)
    cached = handle(app)
  }
  return cached
}

export const handler = async (
  event: Parameters<ReturnType<typeof handle>>[0],
  context: Parameters<ReturnType<typeof handle>>[1],
) => {
  try {
    return await (await getHandler())(event, context)
  } catch (err) {
    console.error('Lambda bootstrap error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: 'Failed to initialize',
      }),
    }
  }
}
