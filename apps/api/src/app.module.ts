import { Module } from '@nestjs/common'
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

@Module({
  imports: [PrismaModule, AuthModule, PatientsModule, DoctorsModule, AppointmentsModule, ConsultationsModule, NotificationsModule, AiModule, ChatModule, SymptomLogsModule],
})
export class AppModule {}

