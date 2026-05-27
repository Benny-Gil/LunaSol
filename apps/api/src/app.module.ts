import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { PatientsModule } from './patients/patients.module'

@Module({
  imports: [PrismaModule, AuthModule, PatientsModule],
})
export class AppModule {}
