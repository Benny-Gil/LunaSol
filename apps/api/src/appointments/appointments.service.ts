import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { BookAppointmentDto } from './dto/book-appointment.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'
import { AppointmentStatus } from '@prisma/client'

/** How long before the slot start a participant may join the consultation room.
 *  Must match the client-side join window (web appointment detail pages). */
const JOIN_LEAD_MS = 5 * 60 * 1000

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async getPatientProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })
    if (!user?.patient) throw new NotFoundException('Patient profile not found')
    return { user, patient: user.patient }
  }

  private async getDoctorProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { doctor: true },
    })
    if (!user?.doctor) throw new NotFoundException('Doctor profile not found')
    return { user, doctor: user.doctor }
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

  async book(clerkId: string, dto: BookAppointmentDto) {
    const { patient } = await this.getPatientProfile(clerkId)

    try {
      const { appointment, notification } = await this.prisma.$transaction(async (tx) => {
        const slot = await tx.availabilitySlot.findUnique({
          where: { id: dto.slotId },
          include: { appointment: true, doctor: { include: { user: true } } },
        })

        if (!slot) throw new NotFoundException('Slot not found')
        if (slot.isBlocked) throw new ConflictException('Slot is blocked')
        if (slot.appointment) throw new ConflictException('Slot is already booked')
        if (slot.startTime <= new Date()) throw new BadRequestException('Slot is in the past')

        const appointment = await tx.appointment.create({
          data: {
            patientId: patient.id,
            doctorId: slot.doctorId,
            slotId: slot.id,
            status: AppointmentStatus.PENDING,
          },
          include: { slot: true, doctor: true, patient: true },
        })

        const notification = await tx.notification.create({
          data: {
            recipientId: slot.doctor.user.id,
            type: 'APPOINTMENT_REQUEST',
            message: `New appointment request from ${patient.name} on ${slot.startTime.toLocaleDateString()}`,
          },
        })

        return { appointment, notification }
      })

      this.notifications.emitToUser(notification.recipientId, 'notification', {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        createdAt: notification.createdAt,
      })

      return appointment
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Slot is already booked')
      throw e
    }
  }

  async listMine(clerkId: string, role: string) {
    if (role === 'doctor') {
      const { doctor } = await this.getDoctorProfile(clerkId)
      return this.prisma.appointment.findMany({
        where: { doctorId: doctor.id },
        include: { slot: true, patient: true },
        orderBy: { slot: { startTime: 'asc' } },
      })
    }

    const { patient } = await this.getPatientProfile(clerkId)
    return this.prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: { slot: true, doctor: true, record: { include: { prescriptions: true } } },
      orderBy: { slot: { startTime: 'asc' } },
    })
  }

  async cancel(clerkId: string, id: string) {
    const { patient } = await this.getPatientProfile(clerkId)

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { slot: true, doctor: { include: { user: true } }, patient: true },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')
    if (appointment.patientId !== patient.id) throw new ForbiddenException('Not your appointment')
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED
    ) {
      throw new ConflictException(`Cannot cancel a ${appointment.status.toLowerCase()} appointment`)
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: { slot: true, doctor: true },
    })

    await this.createNotification(
      appointment.doctor.user.id,
      'APPOINTMENT_CANCELLED',
      `${patient.name} cancelled their appointment on ${appointment.slot.startTime.toLocaleDateString()}`,
    )

    return updated
  }

  async reschedule(clerkId: string, id: string, dto: RescheduleAppointmentDto) {
    const { patient } = await this.getPatientProfile(clerkId)

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { slot: true, doctor: { include: { user: true } }, patient: true },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')
    if (appointment.patientId !== patient.id) throw new ForbiddenException('Not your appointment')
    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
      throw new ConflictException(`Cannot reschedule a ${appointment.status.toLowerCase()} appointment`)
    }

    try {
      const { updated, notification } = await this.prisma.$transaction(async (tx) => {
        const newSlot = await tx.availabilitySlot.findUnique({
          where: { id: dto.newSlotId },
          include: { appointment: true },
        })

        if (!newSlot) throw new NotFoundException('New slot not found')
        if (newSlot.doctorId !== appointment.doctorId) throw new BadRequestException('Slot belongs to a different doctor')
        if (newSlot.isBlocked) throw new ConflictException('New slot is blocked')
        if (newSlot.appointment) throw new ConflictException('New slot is already booked')
        if (newSlot.startTime <= new Date()) throw new BadRequestException('New slot is in the past')

        const updated = await tx.appointment.update({
          where: { id },
          data: { slotId: dto.newSlotId },
          include: { slot: true, doctor: true },
        })

        const notification = await tx.notification.create({
          data: {
            recipientId: appointment.doctor.user.id,
            type: 'APPOINTMENT_RESCHEDULED',
            message: `${patient.name} rescheduled their appointment to ${newSlot.startTime.toLocaleDateString()}`,
          },
        })

        return { updated, notification }
      })

      this.notifications.emitToUser(notification.recipientId, 'notification', {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        createdAt: notification.createdAt,
      })

      return updated
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('New slot is already booked')
      throw e
    }
  }

  async confirm(clerkId: string, id: string) {
    const { doctor } = await this.getDoctorProfile(clerkId)

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { slot: true, patient: { include: { user: true } } },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')
    if (appointment.doctorId !== doctor.id) throw new ForbiddenException('Not your appointment')
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new ConflictException('Only pending appointments can be confirmed')
    }

    const livekitRoom = `appt-${randomUUID()}`

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, livekitRoom },
      include: { slot: true, doctor: true },
    })

    await this.createNotification(
      appointment.patient.user.id,
      'APPOINTMENT_CONFIRMED',
      `Your appointment on ${appointment.slot.startTime.toLocaleDateString()} has been confirmed. Join the session when it's time.`,
    )

    return updated
  }

  async complete(clerkId: string, id: string) {
    const { doctor } = await this.getDoctorProfile(clerkId)

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')
    if (appointment.doctorId !== doctor.id) throw new ForbiddenException('Not your appointment')
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed appointments can be marked complete')
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED },
      include: { slot: true, doctor: true },
    })
  }

  async getOne(clerkId: string, id: string, role: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        slot: true,
        doctor: true,
        patient: true,
        record: { include: { prescriptions: true } },
      },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')

    if (role === 'doctor') {
      const { doctor } = await this.getDoctorProfile(clerkId)
      if (appointment.doctorId !== doctor.id) throw new ForbiddenException('Not your appointment')
    } else {
      const { patient } = await this.getPatientProfile(clerkId)
      if (appointment.patientId !== patient.id) throw new ForbiddenException('Not your appointment')
    }

    return appointment
  }

  async getLivekitToken(clerkId: string, id: string, role: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, patient: true, slot: true },
    })

    if (!appointment) throw new NotFoundException('Appointment not found')

    let displayName: string
    if (role === 'doctor') {
      const { doctor } = await this.getDoctorProfile(clerkId)
      if (appointment.doctorId !== doctor.id) throw new ForbiddenException('Not your appointment')
      displayName = appointment.doctor.name
    } else {
      const { patient } = await this.getPatientProfile(clerkId)
      if (appointment.patientId !== patient.id) throw new ForbiddenException('Not your appointment')
      displayName = appointment.patient.name
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED || !appointment.livekitRoom) {
      throw new ConflictException('Session not available')
    }

    // Enforce the join window server-side. The client gates the "Join" button on
    // the same window, but the token endpoint must not be joinable out-of-band.
    const now = Date.now()
    const start = appointment.slot.startTime.getTime()
    const end = appointment.slot.endTime.getTime()
    if (now < start - JOIN_LEAD_MS || now > end) {
      throw new ForbiddenException(
        'The consultation room is only open from 5 minutes before the appointment until it ends',
      )
    }

    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit is not configured')
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: clerkId,
      name: displayName,
      ttl: '15m',
    })
    at.addGrant({
      room: appointment.livekitRoom,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })

    return {
      token: await at.toJwt(),
      room: appointment.livekitRoom,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    }
  }

  /**
   * Handle a LiveKit webhook. The body is verified against the LiveKit API
   * key/secret (the Authorization header carries a signed JWT whose payload
   * hashes the body). On `participant_joined`, notify the *other* party that
   * their counterpart has entered the consultation room.
   */
  async handleLivekitWebhook(body: string | undefined, authHeader: string | undefined) {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!apiKey || !apiSecret) throw new BadRequestException('LiveKit is not configured')
    if (!body || !authHeader) throw new BadRequestException('Missing webhook body or signature')

    const receiver = new WebhookReceiver(apiKey, apiSecret)
    let event
    try {
      event = await receiver.receive(body, authHeader)
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.event !== 'participant_joined') return

    const room = event.room?.name
    const joinerClerkId = event.participant?.identity
    if (!room || !joinerClerkId) return

    await this.notifyParticipantJoined(room, joinerClerkId)
  }

  private async notifyParticipantJoined(room: string, joinerClerkId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { livekitRoom: room },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    })
    if (!appointment) return

    // Notify whichever party did NOT just join.
    let recipientUserId: string
    let joinerName: string
    if (joinerClerkId === appointment.doctor.user.clerkId) {
      recipientUserId = appointment.patient.user.id
      joinerName = appointment.doctor.name
    } else if (joinerClerkId === appointment.patient.user.clerkId) {
      recipientUserId = appointment.doctor.user.id
      joinerName = appointment.patient.name
    } else {
      return // participant is not part of this appointment
    }

    await this.createNotification(
      recipientUserId,
      'CONSULTATION_PARTICIPANT_JOINED',
      `${joinerName} has joined the consultation.`,
    )
  }
}
