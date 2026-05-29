import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { verifyToken, createClerkClient } from '@clerk/backend'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

// When a user's session token carries no role claim — e.g. an instance whose
// "Customize session token" setting isn't live — fall back to reading
// publicMetadata.role straight from Clerk's Backend API. Cache the lookup so we
// don't hit Clerk on every request for the same user.
const roleCache = new Map<string, { role: string | undefined; expires: number }>()
const ROLE_CACHE_TTL_MS = 60_000

export function clearRoleCache() {
  roleCache.clear()
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header')
    }

    const [type, token] = authHeader.split(' ')
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format')
    }

    try {
      // verifyToken will verify signature, expiry, etc. using CLERK_SECRET_KEY env
      const secretKey = process.env.CLERK_SECRET_KEY
      const decoded = await verifyToken(token, { secretKey })

      // Do NOT default the role. A missing role must fall through to RoleGuard
      // (-> 403), never silently become 'patient' — that would grant a
      // doctor the wrong identity on patient-or-doctor routes.
      let role =
        (decoded as any).role || (decoded as any).metadata?.role || (decoded as any).publicMetadata?.role

      // The session token may not carry the role claim (depends on the Clerk
      // instance's session-token customization). Resolve it from the Backend
      // API as a fallback so role-gated routes work regardless.
      if (!role && decoded.sub) {
        role = await this.resolveRoleFromClerk(decoded.sub)
      }

      request.user = {
        id: decoded.sub, // Clerk user ID
        email: (decoded as any).email || (decoded as any).primaryEmailAddress || '',
        role,
        claims: decoded,
      }
      return true
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : 'Invalid token')
    }
  }

  private async resolveRoleFromClerk(userId: string): Promise<string | undefined> {
    const cached = roleCache.get(userId)
    if (cached && cached.expires > Date.now()) {
      return cached.role
    }

    let role: string | undefined
    try {
      const user = await this.clerk.users.getUser(userId)
      role = (user.publicMetadata as any)?.role
    } catch {
      // Network/API failure — leave role undefined so RoleGuard rejects rather
      // than granting access on an unverified role.
      role = undefined
    }

    roleCache.set(userId, { role, expires: Date.now() + ROLE_CACHE_TTL_MS })
    return role
  }
}
