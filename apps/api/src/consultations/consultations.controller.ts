import { Controller, Get, Post, Patch, Param, Body, Req } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { ConsultationsService } from './consultations.service'
import { UpsertConsultationRecordDto } from './dto/upsert-consultation-record.dto'
import { CreatePrescriptionDto } from './dto/create-prescription.dto'

@Controller('appointments/:id/record')
export class ConsultationsController {
  constructor(private consultationsService: ConsultationsService) {}

  @Roles('patient', 'doctor')
  @Get()
  getRecord(@Req() req: any, @Param('id') id: string) {
    return this.consultationsService.getRecord(req.user.id, id, req.user.role)
  }

  @Roles('doctor')
  @Post()
  createRecord(@Req() req: any, @Param('id') id: string, @Body() dto: UpsertConsultationRecordDto) {
    return this.consultationsService.createRecord(req.user.id, id, dto)
  }

  @Roles('doctor')
  @Patch()
  updateRecord(@Req() req: any, @Param('id') id: string, @Body() dto: UpsertConsultationRecordDto) {
    return this.consultationsService.updateRecord(req.user.id, id, dto)
  }

  @Roles('doctor')
  @Post('prescriptions')
  addPrescription(@Req() req: any, @Param('id') id: string, @Body() dto: CreatePrescriptionDto) {
    return this.consultationsService.addPrescription(req.user.id, id, dto)
  }
}
