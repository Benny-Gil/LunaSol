import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AppointmentsService } from '../appointments/appointments.service'
import { CreateSymptomLogDto } from './dto/create-symptom-log.dto'
import { UpdateSymptomLogDto } from './dto/update-symptom-log.dto'

@Injectable()
export class SymptomLogsService {
  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
  ) {}

  private async getPatientProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })
    if (!user?.patient) throw new NotFoundException('Patient profile not found')
    return { user, patient: user.patient }
  }

  async create(clerkId: string, dto: CreateSymptomLogDto) {
    const { patient } = await this.getPatientProfile(clerkId)
    return this.prisma.symptomLog.create({
      data: {
        patientId: patient.id,
        description: dto.description,
        severity: dto.severity,
        ...(dto.loggedAt ? { loggedAt: new Date(dto.loggedAt) } : {}),
      },
    })
  }

  async listMine(clerkId: string) {
    const { patient } = await this.getPatientProfile(clerkId)
    return this.prisma.symptomLog.findMany({
      where: { patientId: patient.id },
      orderBy: { loggedAt: 'desc' },
    })
  }

  async update(clerkId: string, id: string, dto: UpdateSymptomLogDto) {
    const { patient } = await this.getPatientProfile(clerkId)
    const log = await this.prisma.symptomLog.findUnique({ where: { id } })
    if (!log) throw new NotFoundException('Symptom log not found')
    if (log.patientId !== patient.id) throw new ForbiddenException('Not your symptom log')

    return this.prisma.symptomLog.update({
      where: { id },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.loggedAt ? { loggedAt: new Date(dto.loggedAt) } : {}),
      },
    })
  }

  async remove(clerkId: string, id: string) {
    const { patient } = await this.getPatientProfile(clerkId)
    const log = await this.prisma.symptomLog.findUnique({ where: { id } })
    if (!log) throw new NotFoundException('Symptom log not found')
    if (log.patientId !== patient.id) throw new ForbiddenException('Not your symptom log')

    await this.prisma.symptomLog.delete({ where: { id } })
    return { id }
  }

  /** Doctor read: only permitted if the doctor shares an appointment with the patient. */
  async listForPatient(clerkId: string, patientId: string) {
    await this.appointments.assertDoctorTreatsPatient(clerkId, patientId)
    return this.prisma.symptomLog.findMany({
      where: { patientId },
      orderBy: { loggedAt: 'desc' },
    })
  }
}
