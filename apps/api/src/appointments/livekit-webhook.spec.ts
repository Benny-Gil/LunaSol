import { BadRequestException, INestApplication } from '@nestjs/common'
import { APP_GUARD, Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'

// Mock the LiveKit SDK so we control webhook verification. (This file does not
// exercise AccessToken, so mocking the whole module is safe here.)
jest.mock('livekit-server-sdk', () => ({
  WebhookReceiver: jest.fn(),
}))
import { WebhookReceiver } from 'livekit-server-sdk'

import { AppointmentsService } from './appointments.service'
import { LivekitWebhookController } from './livekit-webhook.controller'
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard'
import { RoleGuard } from '../auth/guards/role.guard'

const ROOM = 'appt-room-123'
const DOCTOR_CLERK = 'clerk-doc'
const PATIENT_CLERK = 'clerk-pat'

const appointmentWithParties = {
  id: 'appt-1',
  livekitRoom: ROOM,
  doctor: { name: 'Dr. Alice', user: { id: 'user-doc', clerkId: DOCTOR_CLERK } },
  patient: { name: 'Bob Patient', user: { id: 'user-pat', clerkId: PATIENT_CLERK } },
}

describe('handleLivekitWebhook (unit)', () => {
  let service: AppointmentsService
  let prisma: { appointment: { findFirst: jest.Mock }; notification: { create: jest.Mock } }
  let notifications: { emitToUser: jest.Mock }
  let receive: jest.Mock

  beforeEach(() => {
    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'secret-at-least-32-chars-long-xxxxx'

    prisma = {
      appointment: { findFirst: jest.fn().mockResolvedValue(appointmentWithParties) },
      notification: { create: jest.fn().mockResolvedValue({ id: 'n1', createdAt: new Date() }) },
    }
    notifications = { emitToUser: jest.fn() }
    service = new AppointmentsService(prisma as any, notifications as any)

    receive = jest.fn()
    ;(WebhookReceiver as jest.Mock).mockImplementation(() => ({ receive }))
  })

  it('notifies the patient when the doctor joins', async () => {
    receive.mockResolvedValue({
      event: 'participant_joined',
      room: { name: ROOM },
      participant: { identity: DOCTOR_CLERK },
    })

    await service.handleLivekitWebhook('{}', 'Bearer sig')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientId: 'user-pat',
        type: 'CONSULTATION_PARTICIPANT_JOINED',
        message: 'Dr. Alice has joined the consultation.',
      }),
    })
    expect(notifications.emitToUser).toHaveBeenCalledWith('user-pat', 'notification', expect.any(Object))
  })

  it('notifies the doctor when the patient joins', async () => {
    receive.mockResolvedValue({
      event: 'participant_joined',
      room: { name: ROOM },
      participant: { identity: PATIENT_CLERK },
    })

    await service.handleLivekitWebhook('{}', 'Bearer sig')

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recipientId: 'user-doc', message: 'Bob Patient has joined the consultation.' }),
    })
  })

  it('ignores non-join events', async () => {
    receive.mockResolvedValue({ event: 'participant_left', room: { name: ROOM }, participant: { identity: DOCTOR_CLERK } })
    await service.handleLivekitWebhook('{}', 'Bearer sig')
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('ignores a participant that is not part of the appointment', async () => {
    receive.mockResolvedValue({ event: 'participant_joined', room: { name: ROOM }, participant: { identity: 'stranger' } })
    await service.handleLivekitWebhook('{}', 'Bearer sig')
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('rejects an invalid signature', async () => {
    receive.mockRejectedValue(new Error('bad signature'))
    await expect(service.handleLivekitWebhook('{}', 'Bearer bad')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects a missing body or signature', async () => {
    await expect(service.handleLivekitWebhook(undefined, 'Bearer sig')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.handleLivekitWebhook('{}', undefined)).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('LivekitWebhookController (integration) — is public', () => {
  let app: INestApplication
  const handleLivekitWebhook = jest.fn().mockResolvedValue(undefined)

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LivekitWebhookController],
      providers: [
        { provide: AppointmentsService, useValue: { handleLivekitWebhook } },
        Reflector,
        // Real global guards, exactly as app.module.ts wires them.
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
        { provide: APP_GUARD, useClass: RoleGuard },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('accepts the webhook without a Clerk Authorization header (200, not 401)', async () => {
    await request(app.getHttpServer()).post('/livekit/webhook').send({}).expect(200)
    expect(handleLivekitWebhook).toHaveBeenCalled()
  })
})
