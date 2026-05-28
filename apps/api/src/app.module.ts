import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PatientsModule } from './patients/patients.module'
import { DoctorsModule } from './doctors/doctors.module'

@Module({
  imports: [PrismaModule, AuthModule, PatientsModule, DoctorsModule],
})
export class AppModule {}
