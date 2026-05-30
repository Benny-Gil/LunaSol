import { Module } from '@nestjs/common'
import { SymptomLogsController } from './symptom-logs.controller'
import { SymptomLogsService } from './symptom-logs.service'
import { AppointmentsModule } from '../appointments/appointments.module'

@Module({
  imports: [AppointmentsModule],
  controllers: [SymptomLogsController],
  providers: [SymptomLogsService],
})
export class SymptomLogsModule {}
