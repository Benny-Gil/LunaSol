import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AllExceptionsFilter } from './all-exceptions.filter'

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter
  let reply: jest.Mock

  const host = (url = '/api/thing') =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url }),
        getResponse: () => ({ __res: true }),
      }),
    }) as any

  beforeEach(() => {
    reply = jest.fn()
    const httpAdapterHost = {
      httpAdapter: { reply, getRequestUrl: (req: any) => req.url },
    }
    filter = new AllExceptionsFilter(httpAdapterHost as any)
  })

  it('preserves an HttpException status and message in a normalized body', () => {
    filter.catch(new NotFoundException('Symptom log not found'), host('/api/symptom-logs/x'))

    const [res, body, status] = reply.mock.calls[0]
    expect(res).toEqual({ __res: true })
    expect(status).toBe(404)
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Symptom log not found',
        path: '/api/symptom-logs/x',
      }),
    )
  })

  it('maps an unknown error to a generic 500 without leaking internals', () => {
    filter.catch(new Error('DB password is hunter2'), host())

    const [, body, status] = reply.mock.calls[0]
    expect(status).toBe(500)
    expect(body.message).toBe('Internal server error')
    expect(JSON.stringify(body)).not.toContain('hunter2')
  })

  it('keeps the original status for other HttpExceptions (403)', () => {
    filter.catch(new ForbiddenException('Not your patient'), host())

    const [, body, status] = reply.mock.calls[0]
    expect(status).toBe(403)
    expect(body.message).toBe('Not your patient')
  })
})
