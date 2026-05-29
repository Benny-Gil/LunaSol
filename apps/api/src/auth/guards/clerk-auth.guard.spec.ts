import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ClerkAuthGuard } from './clerk-auth.guard'

// Mock Clerk's token verification so we control the decoded claims.
jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}))
import { verifyToken } from '@clerk/backend'

const mockedVerify = verifyToken as jest.Mock

function contextWithAuth(header: string | undefined) {
  const req: any = { headers: header ? { authorization: header } : {} }
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext
  return { ctx, req }
}

describe('ClerkAuthGuard role resolution', () => {
  let guard: ClerkAuthGuard

  beforeEach(() => {
    // Reflector that reports the route is not @Public.
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector
    guard = new ClerkAuthGuard(reflector)
    process.env.CLERK_SECRET_KEY = 'sk_test_x'
    mockedVerify.mockReset()
  })

  it('does NOT default a missing role to "patient"', async () => {
    // Decoded token with no role claim anywhere.
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc' })
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.id).toBe('clerk-doc')
    // The bug was `|| 'patient'`; role must stay undefined so RoleGuard rejects.
    expect(req.user.role).toBeUndefined()
  })

  it('uses the role claim when present', async () => {
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc', publicMetadata: { role: 'doctor' } })
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.role).toBe('doctor')
  })
})
