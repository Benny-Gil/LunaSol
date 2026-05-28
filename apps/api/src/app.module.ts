import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PatientsModule } from './patients/patients.module'
import { DoctorsModule } from './doctors/doctors.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { NotificationsModule } from './notifications/notifications.module'

@Module({
  imports: [PrismaModule, AuthModule, PatientsModule, DoctorsModule, AppointmentsModule, NotificationsModule],
})
export class AppModule {}
