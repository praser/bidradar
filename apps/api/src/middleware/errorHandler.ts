import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: err.issues.map((i) => i.message).join('; '),
        statusCode: 400,
      },
      400,
    )
  }

  console.error('Unhandled error:', err)
  return c.json(
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
    },
    500,
  )
}
