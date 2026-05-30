import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { StartConversationDto } from './dto/start-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'
import type {
  ChatMessage,
  ConversationCounterpart,
  ConversationDetail,
  ConversationSummary,
  MessageAttachmentType,
} from '@lunasol/types'

/** A conversation loaded with both participants and their users. */
type ConversationWithParties = Prisma.ConversationGetPayload<{
  include: {
    patient: { include: { user: true } }
    doctor: { include: { user: true } }
  }
}>

type MessageRow = Prisma.MessageGetPayload<Record<string, never>>

// Which side may originate each attachment type — keeps a patient from
// fabricating a prescription, or a doctor from logging the patient's symptoms.
const DOCTOR_ONLY: MessageAttachmentType[] = ['PRESCRIPTION', 'NOTE']
const PATIENT_ONLY: MessageAttachmentType[] = ['AI_SUGGESTION', 'SYMPTOM']

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────────

  async listConversations(clerkId: string, role: string): Promise<ConversationSummary[]> {
    const me = await this.requireUser(clerkId)
    const where: Prisma.ConversationWhereInput =
      role === 'doctor'
        ? { doctorId: me.doctor?.id ?? '__none__' }
        : { patientId: me.patient?.id ?? '__none__' }

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (conversations.length === 0) return []

    // Unread = incoming (not sent by me) and not yet read, per conversation.
    const unreadGroups = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: me.id },
        readAt: null,
      },
      _count: { _all: true },
    })
    const unreadByConversation = new Map(unreadGroups.map((g) => [g.conversationId, g._count._all]))

    return conversations.map((c) => {
      const mySide = c.patientId === me.patient?.id ? 'patient' : 'doctor'
      const last = c.messages[0]
      return {
        id: c.id,
        counterpart: this.counterpartOf(c, mySide),
        lastMessage: last
          ? {
              body: last.body,
              attachmentType: last.attachmentType,
              senderId: last.senderId,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
        updatedAt: c.updatedAt.toISOString(),
      }
    })
  }

  /** Idempotently open the conversation for this pair, then return its thread. */
  async findOrCreate(clerkId: string, role: string, dto: StartConversationDto): Promise<ConversationDetail> {
    const me = await this.requireUser(clerkId)

    let patientId: string
    let doctorId: string
    if (role === 'doctor') {
      if (!me.doctor) throw new NotFoundException('Doctor profile not found')
      if (!dto.patientId) throw new BadRequestException('patientId is required')
      const patient = await this.prisma.patientProfile.findUnique({ where: { id: dto.patientId } })
      if (!patient) throw new NotFoundException('Patient not found')
      doctorId = me.doctor.id
      patientId = patient.id
    } else {
      if (!me.patient) throw new NotFoundException('Patient profile not found')
      if (!dto.doctorId) throw new BadRequestException('doctorId is required')
      const doctor = await this.prisma.doctorProfile.findUnique({ where: { id: dto.doctorId } })
      if (!doctor) throw new NotFoundException('Doctor not found')
      patientId = me.patient.id
      doctorId = doctor.id
    }

    await this.prisma.conversation.upsert({
      where: { patientId_doctorId: { patientId, doctorId } },
      create: { patientId, doctorId },
      update: {},
    })

    // Reload with parties + messages and mark the thread read for this user.
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { patientId_doctorId: { patientId, doctorId } },
      include: { patient: { include: { user: true } }, doctor: { include: { user: true } } },
    })
    return this.loadThread(conversation, me.id, role === 'doctor' ? 'doctor' : 'patient')
  }

  async getMessages(clerkId: string, conversationId: string): Promise<ConversationDetail> {
    const { conversation, me, mySide } = await this.authorize(clerkId, conversationId)
    return this.loadThread(conversation, me.id, mySide)
  }

  async sendMessage(clerkId: string, conversationId: string, dto: SendMessageDto): Promise<ChatMessage> {
    const { conversation, me, mySide } = await this.authorize(clerkId, conversationId)

    const body = dto.body?.trim() || null
    if (!body && !dto.attachmentType) {
      throw new BadRequestException('A message must have text or an attachment')
    }
    if (dto.attachmentType) {
      if (!dto.attachment) throw new BadRequestException('attachment is required for an attachment message')
      if (DOCTOR_ONLY.includes(dto.attachmentType) && mySide !== 'doctor') {
        throw new ForbiddenException(`Only the doctor can attach a ${dto.attachmentType.toLowerCase()}`)
      }
      if (PATIENT_ONLY.includes(dto.attachmentType) && mySide !== 'patient') {
        throw new ForbiddenException(`Only the patient can attach a ${dto.attachmentType.toLowerCase()}`)
      }
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: me.id,
        body,
        attachmentType: dto.attachmentType ?? null,
        attachment: dto.attachmentType
          ? (dto.attachment as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        refId: dto.refId ?? null,
      },
    })
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })

    const chatMessage = this.toChatMessage(message, conversation)

    // Realtime push to the recipient + a persisted notification for the bell.
    const recipientUserId =
      mySide === 'patient' ? conversation.doctor.user.id : conversation.patient.user.id
    const senderName = mySide === 'patient' ? conversation.patient.name : conversation.doctor.name

    this.notifications.emitToUser(recipientUserId, 'chat:message', chatMessage)
    await this.createNotification(
      recipientUserId,
      'CHAT_MESSAGE',
      `New message from ${senderName}`,
    )

    return chatMessage
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async requireUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true, doctor: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  private async authorize(clerkId: string, conversationId: string) {
    const me = await this.requireUser(clerkId)
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { patient: { include: { user: true } }, doctor: { include: { user: true } } },
    })
    if (!conversation) throw new NotFoundException('Conversation not found')

    const isPatient = !!me.patient && conversation.patientId === me.patient.id
    const isDoctor = !!me.doctor && conversation.doctorId === me.doctor.id
    if (!isPatient && !isDoctor) throw new ForbiddenException('Not your conversation')

    return { me, conversation, mySide: (isPatient ? 'patient' : 'doctor') as 'patient' | 'doctor' }
  }

  /** Load the message list and mark incoming messages read for `myUserId`. */
  private async loadThread(
    conversation: ConversationWithParties,
    myUserId: string,
    mySide: 'patient' | 'doctor',
  ): Promise<ConversationDetail> {
    await this.prisma.message.updateMany({
      where: { conversationId: conversation.id, senderId: { not: myUserId }, readAt: null },
      data: { readAt: new Date() },
    })

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 300,
    })

    return {
      id: conversation.id,
      counterpart: this.counterpartOf(conversation, mySide),
      messages: messages.map((m) => this.toChatMessage(m, conversation)),
    }
  }

  private counterpartOf(
    conversation: ConversationWithParties,
    mySide: 'patient' | 'doctor',
  ): ConversationCounterpart {
    if (mySide === 'patient') {
      return {
        id: conversation.doctor.id,
        name: conversation.doctor.name,
        profilePictureUrl: conversation.doctor.profilePictureUrl,
        role: 'doctor',
        specialization: conversation.doctor.specialization,
      }
    }
    return {
      id: conversation.patient.id,
      name: conversation.patient.name,
      profilePictureUrl: conversation.patient.profilePictureUrl,
      role: 'patient',
    }
  }

  private toChatMessage(message: MessageRow, conversation: ConversationWithParties): ChatMessage {
    const senderRole = message.senderId === conversation.patient.user.id ? 'patient' : 'doctor'
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole,
      body: message.body,
      attachmentType: message.attachmentType,
      attachment: (message.attachment as ChatMessage['attachment']) ?? null,
      refId: message.refId,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    }
  }

  private async createNotification(recipientId: string, type: string, message: string) {
    const notification = await this.prisma.notification.create({ data: { recipientId, type, message } })
    this.notifications.emitToUser(recipientId, 'notification', {
      id: notification.id,
      type,
      message,
      createdAt: notification.createdAt,
    })
  }
}
