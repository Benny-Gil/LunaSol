import { Controller, Post, Headers, Req, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common'
import { Webhook } from 'svix'
import { createClerkClient } from '@clerk/backend'
import { PrismaService } from '../prisma/prisma.service'
import { Public } from './decorators/public.decorator'
import { Role } from '@prisma/client'

@Controller('auth')
export class WebhookController {
  private clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  constructor(private prisma: PrismaService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Req() req: any,
  ) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing Svix headers')
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body for webhook verification')
    }

    const payload = req.rawBody.toString('utf8')
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new BadRequestException('CLERK_WEBHOOK_SECRET is not configured on backend')
    }

    const wh = new Webhook(webhookSecret)
    let evt: any

    try {
      evt = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as any
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    const eventType = evt.type

    if (eventType === 'user.created') {
      const { id: clerkId, email_addresses, first_name, last_name, unsafe_metadata } = evt.data
      
      const primaryEmail = email_addresses?.[0]?.email_address || ''
      const roleStr = unsafe_metadata?.role === 'doctor' ? 'doctor' : 'patient'
      const role = roleStr === 'doctor' ? Role.DOCTOR : Role.PATIENT
      const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous User'

      // Synchronize to Database inside a transaction
      await this.prisma.$transaction(async (tx) => {
        // Double check user doesn't already exist
        const existingUser = await tx.user.findUnique({
          where: { clerkId },
        })

        if (!existingUser) {
          const newUser = await tx.user.create({
            data: {
              clerkId,
              email: primaryEmail,
              role,
            },
          })

          if (role === Role.DOCTOR) {
            await tx.doctorProfile.create({
              data: {
                userId: newUser.id,
                name,
                specialization: 'General Medicine',
              },
            })
          } else {
            await tx.patientProfile.create({
              data: {
                userId: newUser.id,
                name,
                birthday: new Date('1990-01-01'),
                weight: 0.0,
                height: 0.0,
              },
            })
          }
        }
      })

      // Sync role back to Clerk publicMetadata so it is embedded in the JWT session token
      try {
        await this.clerkClient.users.updateUserMetadata(clerkId, {
          publicMetadata: {
            role: roleStr,
          },
        })
      } catch (err) {
        console.error(`Failed to update Clerk metadata for user ${clerkId}:`, err)
        // We do not throw here to avoid failing the Clerk webhook delivery if DB sync succeeded
      }
    }

    if (eventType === 'user.deleted') {
      const { id: clerkId } = evt.data
      
      try {
        await this.prisma.user.delete({
          where: { clerkId },
        })
      } catch {
        // If user was already deleted, ignore error
        console.warn(`Attempted to delete non-existent user with clerkId ${clerkId} from DB`)
      }
    }

    return { received: true }
  }
}
