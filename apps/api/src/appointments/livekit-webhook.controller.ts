import { Controller, Post, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { AppointmentsService } from './appointments.service'

/**
 * Receives LiveKit server webhooks. Public (no Clerk auth) — authenticity is
 * established by the signed Authorization header, verified in the service via
 * the LiveKit API key/secret. Configured in `livekit/livekit.yaml`.
 */
@Controller('livekit')
export class LivekitWebhookController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handle(@Headers('authorization') authHeader: string, @Req() req: any) {
    await this.appointmentsService.handleLivekitWebhook(req.rawBody?.toString('utf8'), authHeader)
    return { received: true }
  }
}
