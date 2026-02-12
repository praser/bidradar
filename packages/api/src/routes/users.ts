import { Hono } from 'hono'
import type { AuthEnv } from '../middleware/authenticate.js'

export function userRoutes() {
  const app = new Hono<AuthEnv>()

  // GET /users/me
  app.get('/me', async (c) => {
    const user = c.get('user')
    return c.json(user)
  })

  return app
}
