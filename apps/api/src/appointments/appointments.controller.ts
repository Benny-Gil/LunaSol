import { Controller, Post, Get, Patch, Param, Body, Req, Query } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { AppointmentsService } from './appointments.service'
import { BookAppointmentDto } from './dto/book-appointment.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'

@Controller('appointments')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Roles('patient')
  @Post()
  book(@Req() req: any, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(req.user.id, dto)
  }

  @Roles('patient', 'doctor')
  @Get('mine')
  listMine(@Req() req: any, @Query('patientId') patientId?: string) {
    return this.appointmentsService.listMine(req.user.id, req.user.role, patientId)
  }

  @Roles('patient', 'doctor')
  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.getOne(req.user.id, id, req.user.role)
  }

  @Roles('patient', 'doctor')
  @Get(':id/livekit-token')
  getLivekitToken(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.getLivekitToken(req.user.id, id, req.user.role)
  }

  @Roles('patient')
  @Patch(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.cancel(req.user.id, id)
  }

  @Roles('patient')
  @Patch(':id/reschedule')
  reschedule(@Req() req: any, @Param('id') id: string, @Body() dto: RescheduleAppointmentDto) {
    return this.appointmentsService.reschedule(req.user.id, id, dto)
  }

  @Roles('doctor')
  @Patch(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.confirm(req.user.id, id)
  }

  @Roles('doctor')
  @Patch(':id/complete')
  complete(@Req() req: any, @Param('id') id: string) {
    return this.appointmentsService.complete(req.user.id, id)
  }
}
