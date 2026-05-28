import { Controller, Get, Patch, Param, Req } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  @Roles('patient', 'doctor')
  findAll(@Req() req: any) {
    return this.service.findForUser(req.user.id)
  }

  @Patch(':id/read')
  @Roles('patient', 'doctor')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.service.markRead(req.user.id, id)
  }
}
