import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { AppointmentStatus } from '@prisma/client'
import request from 'supertest'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard'
import { RoleGuard } from '../auth/guards/role.guard'

/**
 * Integration test for the livekit-token endpoint: drives a real HTTP request
 * through routing + both global guards + the controller + the real service,
 * with only PrismaService mocked. Exercises what the unit test can't —
 * route wiring, @Roles enforcement, and exception → HTTP status mapping.
 *
 * Auth is faked via a stub ClerkAuthGuard that reads an `x-test-auth:
 * "<role>:<clerkId>"` header (mirroring how the real guard populates req.user).
 * The RoleGuard is kept real so authorization is genuinely tested.
 */
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const header = req.headers['x-test-auth'] as string | undefined
    if (!header) return false // -> 403 (Nest's default when a guard returns false)
    const [role, id] = header.split(':')
    req.user = { id, role }
    return true
  }
}

describe('AppointmentsController (integration) — livekit-token', () => {
  let app: INestApplication
  let prisma: {
    appointment: { findUnique: jest.Mock }
    user: { findUnique: jest.Mock }
  }

  const ROOM = 'appt-room-xyz'
  const confirmedAppointment = {
    id: 'appt-1',
    doctorId: 'doc-1',
    patientId: 'pat-1',
    status: AppointmentStatus.CONFIRMED,
    livekitRoom: ROOM,
    doctor: { id: 'doc-1', name: 'Dr. Alice' },
    patient: { id: 'pat-1', name: 'Bob Patient' },
  }

  beforeAll(async () => {
    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'test-secret-at-least-32-chars-long!!'
    process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://meet.example.com'

    prisma = {
      appointment: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: {} },
        // Global guards, mirroring app.module.ts. ClerkAuthGuard is stubbed;
        // RoleGuard is the real implementation.
        { provide: APP_GUARD, useClass: StubAuthGuard },
        { provide: APP_GUARD, useClass: RoleGuard },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(StubAuthGuard)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  const url = '/appointments/appt-1/livekit-token'

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get(url).expect(403)
  })

  it('rejects a role outside @Roles(patient, doctor)', async () => {
    prisma.appointment.findUnique.mockResolvedValue(confirmedAppointment)
    await request(app.getHttpServer()).get(url).set('x-test-auth', 'admin:clerk-x').expect(403)
  })

  it('issues a token for the owning doctor (200 with token/room/url)', async () => {
    prisma.appointment.findUnique.mockResolvedValue(confirmedAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: 'clerk-doc',
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    const res = await request(app.getHttpServer())
      .get(url)
      .set('x-test-auth', 'doctor:clerk-doc')
      .expect(200)

    expect(res.body.room).toBe(ROOM)
    expect(res.body.url).toBe('wss://meet.example.com')
    expect(typeof res.body.token).toBe('string')
  })

  it('maps ForbiddenException to 403 for a non-owning patient', async () => {
    prisma.appointment.findUnique.mockResolvedValue(confirmedAppointment)
    prisma.user.findUnique.mockResolvedValue({
      clerkId: 'clerk-pat',
      patient: { id: 'pat-OTHER', name: 'Mallory' },
    })

    await request(app.getHttpServer())
      .get(url)
      .set('x-test-auth', 'patient:clerk-pat')
      .expect(403)
  })

  it('maps ConflictException to 409 when the appointment is not CONFIRMED', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      ...confirmedAppointment,
      status: AppointmentStatus.PENDING,
    })
    prisma.user.findUnique.mockResolvedValue({
      clerkId: 'clerk-doc',
      doctor: { id: 'doc-1', name: 'Dr. Alice' },
    })

    await request(app.getHttpServer())
      .get(url)
      .set('x-test-auth', 'doctor:clerk-doc')
      .expect(409)
  })

  it('maps NotFoundException to 404 for an unknown appointment', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null)
    await request(app.getHttpServer())
      .get('/appointments/missing/livekit-token')
      .set('x-test-auth', 'doctor:clerk-doc')
      .expect(404)
  })
})
