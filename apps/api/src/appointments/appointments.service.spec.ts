import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client'
import { AppointmentsService } from './appointments.service'

/** Decode a JWT payload without verifying its signature. */
function decodeJwt(token: string): Record<string, any> {
  const payload = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

describe('AppointmentsService.getLivekitToken', () => {
  let service: AppointmentsService
  let prisma: {
    appointment: { findUnique: jest.Mock }
    user: { findUnique: jest.Mock }
  }

  const CLERK_ID = 'clerk_user_1'
  const ROOM = 'appt-room-123'

  const baseAppointment = {
    id: 'appt-1',
    doctorId: 'doc-1',
    patientId: 'pat-1',
    status: AppointmentStatus.CONFIRMED,
    livekitRoom: ROOM,
    doctor: { id: 'doc-1', name: 'Dr. Alice' },
    patient: { id: 'pat-1', name: 'Bob Patient' },
  }

  beforeEach(() => {
    prisma = {
      appointment: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    }
    // NotificationsService is unused by getLivekitToken; pass a stub.
    service = new AppointmentsService(prisma as any, {} as any)

    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'devsecret-at-least-32-chars-long!!'
    process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://meet.example.com'
  })

  it('throws NotFound when the appointment does not exist', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null)

    await expect(service.getLivekitToken(CLERK_ID, 'missing', 'doctor')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('throws Forbidden when a doctor requests an appointment that is not theirs', async () => {
    prisma.appointment.findUnique.mockResolvedValue(baseAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      doctor: { id: 'doc-OTHER', name: 'Dr. Eve' },
    })

    await expect(service.getLivekitToken(CLERK_ID, 'appt-1', 'doctor')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('throws Forbidden when a patient requests an appointment that is not theirs', async () => {
    prisma.appointment.findUnique.mockResolvedValue(baseAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      patient: { id: 'pat-OTHER', name: 'Mallory' },
    })

    await expect(service.getLivekitToken(CLERK_ID, 'appt-1', 'patient')).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('throws Conflict when the appointment is not CONFIRMED', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      ...baseAppointment,
      status: AppointmentStatus.PENDING,
    })
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    await expect(service.getLivekitToken(CLERK_ID, 'appt-1', 'doctor')).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('throws Conflict when the room has not been provisioned', async () => {
    prisma.appointment.findUnique.mockResolvedValue({ ...baseAppointment, livekitRoom: null })
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    await expect(service.getLivekitToken(CLERK_ID, 'appt-1', 'doctor')).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('throws BadRequest when LiveKit credentials are not configured', async () => {
    delete process.env.LIVEKIT_API_KEY
    prisma.appointment.findUnique.mockResolvedValue(baseAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    await expect(service.getLivekitToken(CLERK_ID, 'appt-1', 'doctor')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('issues a scoped token for the owning doctor', async () => {
    prisma.appointment.findUnique.mockResolvedValue(baseAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    const result = await service.getLivekitToken(CLERK_ID, 'appt-1', 'doctor')

    expect(result.room).toBe(ROOM)
    expect(result.url).toBe('wss://meet.example.com')
    expect(typeof result.token).toBe('string')

    const payload = decodeJwt(result.token)
    expect(payload.sub).toBe(CLERK_ID)
    expect(payload.name).toBe('Dr. Alice')
    expect(payload.video.room).toBe(ROOM)
    expect(payload.video.roomJoin).toBe(true)
    expect(payload.video.canPublish).toBe(true)
    expect(payload.video.canSubscribe).toBe(true)
  })

  it('uses the patient name for an owning patient', async () => {
    prisma.appointment.findUnique.mockResolvedValue(baseAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: CLERK_ID,
      patient: { id: 'pat-1', name: 'Bob Patient' },
    })

    const result = await service.getLivekitToken(CLERK_ID, 'appt-1', 'patient')

    const payload = decodeJwt(result.token)
    expect(payload.name).toBe('Bob Patient')
    expect(payload.video.room).toBe(ROOM)
  })
})
