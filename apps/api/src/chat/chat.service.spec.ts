import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ChatService } from './chat.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

describe('ChatService', () => {
  let service: ChatService

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    patientProfile: { findUnique: jest.fn() },
    doctorProfile: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  }
  const mockNotifications = { emitToUser: jest.fn() }

  // Fixtures: clerk id 'pat-clerk' is the patient; the conversation is between
  // patient profile 'pat-1' (user u-pat) and doctor profile 'doc-1' (user u-doc).
  const patientUser = { id: 'u-pat', role: 'PATIENT', patient: { id: 'pat-1' }, doctor: null }
  const strangerUser = { id: 'u-x', role: 'PATIENT', patient: { id: 'pat-99' }, doctor: null }
  const conversation = {
    id: 'conv-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    patient: { id: 'pat-1', name: 'Pat', profilePictureUrl: null, user: { id: 'u-pat' } },
    doctor: { id: 'doc-1', name: 'Doc', specialization: 'Cardiology', profilePictureUrl: null, user: { id: 'u-doc' } },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile()
    service = module.get(ChatService)
    jest.clearAllMocks()
  })

  describe('sendMessage', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(patientUser)
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation)
      mockPrisma.message.create.mockResolvedValue({
        id: 'm-1', conversationId: 'conv-1', senderId: 'u-pat', body: 'hi',
        attachmentType: null, attachment: null, refId: null, readAt: null, createdAt: new Date(),
      })
      mockPrisma.conversation.update.mockResolvedValue(conversation)
      mockPrisma.notification.create.mockResolvedValue({ id: 'n-1', createdAt: new Date() })
    })

    it('rejects an empty message (no text, no attachment)', async () => {
      await expect(service.sendMessage('pat-clerk', 'conv-1', {})).rejects.toThrow(BadRequestException)
    })

    it('forbids a patient from attaching a prescription (doctor-only)', async () => {
      await expect(
        service.sendMessage('pat-clerk', 'conv-1', {
          attachmentType: 'PRESCRIPTION',
          attachment: { medicationName: 'X', dosage: '1', frequency: '1', duration: '1' } as any,
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('rejects a malformed AI_SUGGESTION (non-array recommendations) — the render-crash guard', async () => {
      await expect(
        service.sendMessage('pat-clerk', 'conv-1', {
          attachmentType: 'AI_SUGGESTION',
          attachment: { symptoms: 'cough', recommendations: 'nope' } as any,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('accepts a well-formed AI_SUGGESTION from the patient', async () => {
      await expect(
        service.sendMessage('pat-clerk', 'conv-1', {
          attachmentType: 'AI_SUGGESTION',
          attachment: { symptoms: 'cough', recommendations: [{ name: 'Dr A', specialization: 'ENT' }] } as any,
        }),
      ).resolves.toMatchObject({ id: 'm-1' })
    })

    it('sends text, pushes realtime to the doctor, and persists a notification', async () => {
      const msg = await service.sendMessage('pat-clerk', 'conv-1', { body: 'hi' })

      expect(msg).toMatchObject({ id: 'm-1', senderRole: 'patient', body: 'hi' })
      // Realtime chat event goes to the *doctor's* user room (the recipient).
      expect(mockNotifications.emitToUser).toHaveBeenCalledWith('u-doc', 'chat:message', expect.objectContaining({ id: 'm-1' }))
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recipientId: 'u-doc', type: 'CHAT_MESSAGE' }) }),
      )
    })

    it('forbids a non-participant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(strangerUser)
      await expect(service.sendMessage('x-clerk', 'conv-1', { body: 'hi' })).rejects.toThrow(ForbiddenException)
    })
  })

  describe('findOrCreate', () => {
    it('requires a doctorId when a patient opens a thread', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(patientUser)
      await expect(service.findOrCreate('pat-clerk', 'patient', {})).rejects.toThrow(BadRequestException)
    })
  })

  describe('getMessages', () => {
    it('fetches the latest messages and returns them oldest→newest, marking read', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(patientUser)
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation)
      mockPrisma.message.updateMany.mockResolvedValue({ count: 1 })
      const row = (id: string, day: number) => ({
        id, conversationId: 'conv-1', senderId: 'u-doc', body: id,
        attachmentType: null, attachment: null, refId: null, readAt: null, createdAt: new Date(`2026-01-0${day}`),
      })
      // DB returns newest-first (desc); the service must reverse to oldest-first.
      mockPrisma.message.findMany.mockResolvedValue([row('m-3', 3), row('m-2', 2), row('m-1', 1)])

      const detail = await service.getMessages('pat-clerk', 'conv-1')

      expect(detail.messages.map((m) => m.id)).toEqual(['m-1', 'm-2', 'm-3'])
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 300 }),
      )
      expect(mockPrisma.message.updateMany).toHaveBeenCalled()
    })
  })
})
