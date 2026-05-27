import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { verifyToken } from '@clerk/backend'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class ClerkAuthGuard implements CanActivate {
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
      
      request.user = {
        id: decoded.sub, // Clerk user ID
        email: (decoded as any).email || (decoded as any).primaryEmailAddress || '',
        role: (decoded as any).role || (decoded as any).metadata?.role || (decoded as any).publicMetadata?.role || 'patient',
        claims: decoded,
      }
      return true
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : 'Invalid token')
    }
  }
}
