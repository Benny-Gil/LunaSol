import { Module } from '@nestjs/common'
import { AppointmentsController } from './appointments.controller'
import { LivekitWebhookController } from './livekit-webhook.controller'
import { AppointmentsService } from './appointments.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [AppointmentsController, LivekitWebhookController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
