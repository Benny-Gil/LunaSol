import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ConsultationsModule } from '../consultations/consultations.module'
import { RemindersController } from './reminders.controller'
import { RemindersService } from './reminders.service'

@Module({
  imports: [PrismaModule, NotificationsModule, ConsultationsModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
