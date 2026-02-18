import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { loadEnv } from './env.js'

const env = await loadEnv()
const app = createApp(env)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Bidradar API listening on http://localhost:${info.port}`)
})
