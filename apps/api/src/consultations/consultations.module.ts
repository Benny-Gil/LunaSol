import { Module } from '@nestjs/common'
import { ConsultationsController } from './consultations.controller'
import { ConsultationsService } from './consultations.service'
import { AppointmentsModule } from '../appointments/appointments.module'

@Module({
  imports: [AppointmentsModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}
