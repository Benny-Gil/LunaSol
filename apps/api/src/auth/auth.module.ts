import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ClerkAuthGuard } from './guards/clerk-auth.guard'
import { RoleGuard } from './guards/role.guard'
import { WebhookController } from './webhook.controller'

@Module({
  controllers: [WebhookController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AuthModule {}
