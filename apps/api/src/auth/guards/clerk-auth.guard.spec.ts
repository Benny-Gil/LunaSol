import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ClerkAuthGuard, clearRoleCache } from './clerk-auth.guard'

// Mock Clerk's token verification and backend client so we control the
// decoded claims and the publicMetadata fallback lookup.
const mockGetUser = jest.fn()
jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(() => ({ users: { getUser: mockGetUser } })),
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
    mockGetUser.mockReset()
    clearRoleCache()
  })

  it('does NOT default a missing role to "patient"', async () => {
    // Decoded token with no role claim, and Clerk has no role in publicMetadata.
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc' })
    mockGetUser.mockResolvedValue({ publicMetadata: {} })
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.id).toBe('clerk-doc')
    // The bug was `|| 'patient'`; role must stay undefined so RoleGuard rejects.
    expect(req.user.role).toBeUndefined()
  })

  it('uses the role claim when present (no backend lookup)', async () => {
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc', publicMetadata: { role: 'doctor' } })
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.role).toBe('doctor')
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('falls back to Clerk publicMetadata when the token has no role claim', async () => {
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc-2' })
    mockGetUser.mockResolvedValue({ publicMetadata: { role: 'doctor' } })
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.role).toBe('doctor')
    expect(mockGetUser).toHaveBeenCalledWith('clerk-doc-2')
  })

  it('leaves role undefined when the backend lookup fails', async () => {
    mockedVerify.mockResolvedValue({ sub: 'clerk-doc-3' })
    mockGetUser.mockRejectedValue(new Error('clerk down'))
    const { ctx, req } = contextWithAuth('Bearer good-token')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(req.user.role).toBeUndefined()
  })
})
