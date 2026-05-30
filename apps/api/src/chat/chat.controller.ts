import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common'
import { Roles } from '../auth/decorators/roles.decorator'
import { ChatService } from './chat.service'
import { StartConversationDto } from './dto/start-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Roles('patient', 'doctor')
  @Get('conversations')
  list(@Req() req: any) {
    return this.chatService.listConversations(req.user.id, req.user.role)
  }

  @Roles('patient', 'doctor')
  @Post('conversations')
  start(@Req() req: any, @Body() dto: StartConversationDto) {
    return this.chatService.findOrCreate(req.user.id, req.user.role, dto)
  }

  @Roles('patient', 'doctor')
  @Get('conversations/:id/messages')
  messages(@Req() req: any, @Param('id') id: string) {
    return this.chatService.getMessages(req.user.id, id)
  }

  @Roles('patient', 'doctor')
  @Post('conversations/:id/messages')
  send(@Req() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.id, id, dto)
  }
}
