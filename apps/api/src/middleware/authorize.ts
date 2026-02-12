import { createMiddleware } from 'hono/factory'
import type { Role } from '@bidradar/core'
import type { AuthEnv } from './authenticate.js'

export function authorize(...allowedRoles: Role[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user')
    if (!allowedRoles.includes(user.role)) {
      return c.json(
        {
          error: 'FORBIDDEN',
          message: 'Insufficient permissions',
          statusCode: 403,
        },
        403,
      )
    }
    await next()
  })
}
