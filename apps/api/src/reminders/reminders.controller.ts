import { Controller, Get, Patch, Param, Req } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { RemindersService } from './reminders.service'

@Controller('reminders')
export class RemindersController {
  constructor(private remindersService: RemindersService) {}

  @Roles('patient')
  @Get('mine')
  listMine(@Req() req: any) {
    return this.remindersService.listMine(req.user.id)
  }

  @Roles('patient')
  @Patch(':id/taken')
  markTaken(@Req() req: any, @Param('id') id: string) {
    return this.remindersService.markTaken(req.user.id, id)
  }
}
