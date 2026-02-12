import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { authenticate, type AuthEnv } from './middleware/authenticate.js'
import { authorize } from './middleware/authorize.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { offerRoutes } from './routes/offers.js'
import { reconcileRoutes } from './routes/reconcile.js'
import { userRoutes } from './routes/users.js'
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

  // Protected routes — admin only
  const adminOnly = new Hono<AuthEnv>()
  adminOnly.use('*', authenticate(env.JWT_SECRET))
  adminOnly.use('*', authorize('admin'))
  adminOnly.route('/reconcile', reconcileRoutes())

  app.route('/', authenticated)
  app.route('/', adminOnly)

  return app
}
