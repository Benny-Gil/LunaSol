import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'

/**
 * Catch-all exception filter: normalizes every error response to a consistent
 * shape, preserves HttpException status/messages, maps unknown errors to a
 * generic 500 (so internals never leak to clients), and logs the real cause of
 * unhandled errors with a stack trace. Registered globally via APP_FILTER.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter')

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()
    const request = ctx.getRequest()
    const path = httpAdapter.getRequestUrl(request)

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    let message: string | string[]
    let error: string
    if (isHttp) {
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
        error = exception.name
      } else {
        const r = res as { message?: string | string[]; error?: string }
        message = r.message ?? exception.message
        error = r.error ?? exception.name
      }
    } else {
      // Don't leak internal error details to the client.
      message = 'Internal server error'
      error = 'InternalServerError'
    }

    // HttpExceptions are expected control flow; only log the unexpected ones.
    if (!isHttp) {
      this.logger.error(
        `Unhandled exception on ${path}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    httpAdapter.reply(
      ctx.getResponse(),
      { statusCode: status, error, message, path, timestamp: new Date().toISOString() },
      status,
    )
  }
}
