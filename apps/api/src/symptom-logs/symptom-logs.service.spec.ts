import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { SymptomSeverity } from '@prisma/client'
import { SymptomLogsService } from './symptom-logs.service'

describe('SymptomLogsService', () => {
  let service: SymptomLogsService
  let prisma: {
    user: { findUnique: jest.Mock }
    symptomLog: {
      create: jest.Mock
      findMany: jest.Mock
      findUnique: jest.Mock
      update: jest.Mock
      delete: jest.Mock
    }
  }
  let appointments: { assertDoctorTreatsPatient: jest.Mock }

  const CLERK_ID = 'clerk_patient_1'
  const PATIENT = { id: 'pat-1', name: 'Bob Patient' }

  const mockOwningPatient = () =>
    prisma.user.findUnique.mockResolvedValue({ clerkId: CLERK_ID, patient: PATIENT })

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      symptomLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    }
    appointments = { assertDoctorTreatsPatient: jest.fn() }
    service = new SymptomLogsService(prisma as any, appointments as any)
  })

  describe('create', () => {
    it('creates a log owned by the resolved patient', async () => {
      mockOwningPatient()
      prisma.symptomLog.create.mockResolvedValue({ id: 'log-1' })

      await service.create(CLERK_ID, { description: 'Headache', severity: SymptomSeverity.MILD })

      expect(prisma.symptomLog.create).toHaveBeenCalledWith({
        data: { patientId: PATIENT.id, description: 'Headache', severity: SymptomSeverity.MILD },
      })
    })

    it('throws NotFound when there is no patient profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        service.create(CLERK_ID, { description: 'x', severity: SymptomSeverity.MILD }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('update', () => {
    it('throws Forbidden when the log belongs to another patient', async () => {
      mockOwningPatient()
      prisma.symptomLog.findUnique.mockResolvedValue({ id: 'log-1', patientId: 'pat-OTHER' })

      await expect(
        service.update(CLERK_ID, 'log-1', { severity: SymptomSeverity.SEVERE }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.symptomLog.update).not.toHaveBeenCalled()
    })

    it('updates an owned log', async () => {
      mockOwningPatient()
      prisma.symptomLog.findUnique.mockResolvedValue({ id: 'log-1', patientId: PATIENT.id })
      prisma.symptomLog.update.mockResolvedValue({ id: 'log-1' })

      await service.update(CLERK_ID, 'log-1', { severity: SymptomSeverity.SEVERE })

      expect(prisma.symptomLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: { severity: SymptomSeverity.SEVERE },
      })
    })
  })

  describe('remove', () => {
    it('throws Forbidden when deleting another patient log', async () => {
      mockOwningPatient()
      prisma.symptomLog.findUnique.mockResolvedValue({ id: 'log-1', patientId: 'pat-OTHER' })

      await expect(service.remove(CLERK_ID, 'log-1')).rejects.toBeInstanceOf(ForbiddenException)
      expect(prisma.symptomLog.delete).not.toHaveBeenCalled()
    })
  })

  describe('listForPatient', () => {
    it('authorizes the doctor before returning logs', async () => {
      appointments.assertDoctorTreatsPatient.mockResolvedValue(undefined)
      prisma.symptomLog.findMany.mockResolvedValue([{ id: 'log-1' }])

      const result = await service.listForPatient('clerk_doctor_1', 'pat-1')

      expect(appointments.assertDoctorTreatsPatient).toHaveBeenCalledWith('clerk_doctor_1', 'pat-1')
      expect(result).toEqual([{ id: 'log-1' }])
    })

    it('propagates Forbidden from the authorization check and does not query logs', async () => {
      appointments.assertDoctorTreatsPatient.mockRejectedValue(new ForbiddenException())

      await expect(service.listForPatient('clerk_doctor_1', 'pat-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      )
      expect(prisma.symptomLog.findMany).not.toHaveBeenCalled()
    })
  })
})
