import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import { registerAuthRoutes } from './auth/routes.ts'
import { env } from './env.ts'
import { HttpError, sendError } from './http.ts'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin not allowed'))
    },
    credentials: true,
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  const health = (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'study-planner-api' })
  }
  app.get('/health', health)
  app.get('/api/health', health)

  registerAuthRoutes(app)

  app.use((_req, res) => {
    sendError(res, 404, 'مسیر پیدا نشد.')
  })

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }
    if (error instanceof HttpError) {
      sendError(res, error.status, error.message)
      return
    }
    const message = error instanceof Error ? error.message : ''
    if (message === 'Origin not allowed') {
      sendError(res, 403, 'Origin not allowed')
      return
    }
    console.error(error)
    sendError(res, 500, 'خطای داخلی سرور.')
  })

  return app
}
