import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { SymptomLogsService } from './symptom-logs.service'
import { CreateSymptomLogDto } from './dto/create-symptom-log.dto'
import { UpdateSymptomLogDto } from './dto/update-symptom-log.dto'

@Controller('symptom-logs')
export class SymptomLogsController {
  constructor(private symptomLogsService: SymptomLogsService) {}

  @Roles('patient')
  @Post()
  create(@Req() req: any, @Body() dto: CreateSymptomLogDto) {
    return this.symptomLogsService.create(req.user.id, dto)
  }

  @Roles('patient')
  @Get('mine')
  listMine(@Req() req: any) {
    return this.symptomLogsService.listMine(req.user.id)
  }

  @Roles('patient')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSymptomLogDto) {
    return this.symptomLogsService.update(req.user.id, id, dto)
  }

  @Roles('patient')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.symptomLogsService.remove(req.user.id, id)
  }

  @Roles('doctor')
  @Get('patient/:patientId')
  listForPatient(@Req() req: any, @Param('patientId') patientId: string) {
    return this.symptomLogsService.listForPatient(req.user.id, patientId)
  }
}
