import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authenticate, type AuthEnv } from './middleware/authenticate.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { offerRoutes } from './routes/offers.js'
import { userRoutes } from './routes/users.js'
import { managementRoutes } from './routes/management.js'
import { apiKeyRoutes } from './routes/api-keys.js'
import { workerRoutes } from './routes/worker.js'
import type { Env } from './env.js'

export function createApp(env: Env) {
  const app = new Hono()

  app.onError(errorHandler)
  app.use('*', logger())
  app.use('*', cors())

  // Public routes
  app.route('/auth', authRoutes(env))

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Protected routes — any authenticated user
  const authenticated = new Hono<AuthEnv>()
  authenticated.use('*', authenticate(env.JWT_SECRET))
  authenticated.route('/offers', offerRoutes())
  authenticated.route('/users', userRoutes())
  authenticated.route('/management', managementRoutes(env))
  authenticated.route('/api-keys', apiKeyRoutes())
  authenticated.route('/worker', workerRoutes())

  app.route('/', authenticated)

  return app
}
