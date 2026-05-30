import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { RemindersService } from './reminders.service'

describe('RemindersService.runDueReminders (due/dedup logic)', () => {
  let service: RemindersService
  let prisma: {
    medicationReminder: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; update: jest.Mock }
    patientProfile: { findUnique: jest.Mock }
    notification: { create: jest.Mock }
    user: { findUnique: jest.Mock }
  }
  let notifications: { emitToUser: jest.Mock }
  let consultations: { listPrescriptionsForReminders: jest.Mock }

  const NOW = new Date('2026-05-10T08:00:00')

  const activeRx = {
    id: 'rx-1',
    medicationName: 'Cetirizine',
    dosage: '10mg',
    frequency: 'Once daily',
    duration: '14 days',
    createdAt: new Date('2026-05-08T09:00:00'),
    patientId: 'pat-1',
  }

  beforeEach(() => {
    prisma = {
      medicationReminder: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'mr-1' }),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      patientProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'user-1' }) },
      notification: { create: jest.fn().mockResolvedValue({ id: 'n-1', type: 'MEDICATION_REMINDER', message: 'm', createdAt: NOW }) },
      user: { findUnique: jest.fn() },
    }
    notifications = { emitToUser: jest.fn() }
    consultations = { listPrescriptionsForReminders: jest.fn().mockResolvedValue([activeRx]) }
    service = new RemindersService(prisma as any, notifications as any, consultations as any)
  })

  it('creates a reminder + notification for an active prescription with no prior reminder', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue(null)

    const sent = await service.runDueReminders(NOW)

    expect(sent).toBe(1)
    expect(prisma.medicationReminder.create).toHaveBeenCalledTimes(1)
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientId: 'user-1', type: 'MEDICATION_REMINDER' }) }),
    )
    expect(notifications.emitToUser).toHaveBeenCalledWith('user-1', 'notification', expect.any(Object))
  })

  it('does NOT resend when a reminder already exists for the window (dedup)', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue({ id: 'existing' })

    const sent = await service.runDueReminders(NOW)

    expect(sent).toBe(0)
    expect(prisma.medicationReminder.create).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('skips prescriptions whose course has already elapsed', async () => {
    consultations.listPrescriptionsForReminders.mockResolvedValue([
      { ...activeRx, createdAt: new Date('2026-04-01T09:00:00'), duration: '5 days' },
    ])
    prisma.medicationReminder.findUnique.mockResolvedValue(null)

    const sent = await service.runDueReminders(NOW)

    expect(sent).toBe(0)
    expect(prisma.medicationReminder.create).not.toHaveBeenCalled()
  })

  it('treats a P2002 race on create as already-sent (no throw)', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue(null)
    prisma.medicationReminder.create.mockRejectedValue({ code: 'P2002' })

    const sent = await service.runDueReminders(NOW)

    expect(sent).toBe(0)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('never throws out of the cron callback even if the query fails', async () => {
    consultations.listPrescriptionsForReminders.mockRejectedValue(new Error('db down'))

    await expect(service.runDueReminders(NOW)).resolves.toBe(0)
  })
})

describe('RemindersService.markTaken', () => {
  let service: RemindersService
  let prisma: any

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ patient: { id: 'pat-1' } }) },
      medicationReminder: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'mr-1', taken: true }),
      },
    }
    service = new RemindersService(prisma, {} as any, {} as any)
  })

  it('marks the reminder taken', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue({ id: 'mr-1', patientId: 'pat-1' })
    await service.markTaken('clerk-1', 'mr-1')
    expect(prisma.medicationReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'mr-1' }, data: expect.objectContaining({ taken: true }) }),
    )
  })

  it('throws NotFound for a missing reminder', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue(null)
    await expect(service.markTaken('clerk-1', 'missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('throws Forbidden when the reminder belongs to another patient', async () => {
    prisma.medicationReminder.findUnique.mockResolvedValue({ id: 'mr-1', patientId: 'pat-OTHER' })
    await expect(service.markTaken('clerk-1', 'mr-1')).rejects.toBeInstanceOf(ForbiddenException)
  })
})
