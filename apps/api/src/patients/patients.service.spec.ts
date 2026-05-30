import { NotFoundException } from '@nestjs/common'
import { PatientsService } from './patients.service'

describe('PatientsService', () => {
  let service: PatientsService
  let prisma: {
    user: { findUnique: jest.Mock }
    patientProfile: { update: jest.Mock; create: jest.Mock }
    patientMetric: { findMany: jest.Mock; create: jest.Mock }
  }

  const CLERK_ID = 'clerk_patient_1'
  const PATIENT = {
    id: 'pat-1',
    userId: 'user-1',
    name: 'Bob Patient',
    birthday: new Date('1990-01-01'),
    weight: 70,
    height: 175,
  }

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      patientProfile: { update: jest.fn(), create: jest.fn() },
      patientMetric: { findMany: jest.fn(), create: jest.fn() },
    }
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy'
    service = new PatientsService(prisma as any)
  })

  describe('getMetrics', () => {
    it('throws NotFound when the patient profile does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getMetrics(CLERK_ID)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('returns the patient metrics ordered oldest-first', async () => {
      prisma.user.findUnique.mockResolvedValue({ clerkId: CLERK_ID, patient: PATIENT })
      const rows = [
        { id: 'm1', patientId: 'pat-1', weight: 72, height: 175, recordedAt: new Date() },
      ]
      prisma.patientMetric.findMany.mockResolvedValue(rows)

      const result = await service.getMetrics(CLERK_ID)

      expect(result).toBe(rows)
      expect(prisma.patientMetric.findMany).toHaveBeenCalledWith({
        where: { patientId: 'pat-1' },
        orderBy: { recordedAt: 'asc' },
      })
    })
  })

  describe('updateProfile metric snapshotting', () => {
    beforeEach(() => {
      // ensurePatientRecord resolves to an existing user with a patient profile.
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        clerkId: CLERK_ID,
        patient: PATIENT,
      })
    })

    it('snapshots a metric row when weight changes', async () => {
      prisma.patientProfile.update.mockResolvedValue({ ...PATIENT, weight: 68 })

      await service.updateProfile(CLERK_ID, { weight: 68 } as any)

      expect(prisma.patientMetric.create).toHaveBeenCalledWith({
        data: { patientId: 'pat-1', weight: 68, height: 175 },
      })
    })

    it('does not snapshot when weight/height are unchanged', async () => {
      prisma.patientProfile.update.mockResolvedValue({ ...PATIENT })

      await service.updateProfile(CLERK_ID, { name: 'New Name' } as any)

      expect(prisma.patientMetric.create).not.toHaveBeenCalled()
    })

    it('does not snapshot when weight is set to the same value', async () => {
      prisma.patientProfile.update.mockResolvedValue({ ...PATIENT })

      await service.updateProfile(CLERK_ID, { weight: 70 } as any)

      expect(prisma.patientMetric.create).not.toHaveBeenCalled()
    })
  })
})
