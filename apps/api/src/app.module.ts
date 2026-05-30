import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PatientsModule } from './patients/patients.module'
import { DoctorsModule } from './doctors/doctors.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { ConsultationsModule } from './consultations/consultations.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AiModule } from './ai/ai.module'
import { ChatModule } from './chat/chat.module'
import { SymptomLogsModule } from './symptom-logs/symptom-logs.module'
import { RemindersModule } from './reminders/reminders.module'

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, AuthModule, PatientsModule, DoctorsModule, AppointmentsModule, ConsultationsModule, NotificationsModule, AiModule, ChatModule, SymptomLogsModule, RemindersModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}

