import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AppointmentsService } from '../appointments/appointments.service'
import { UpsertConsultationRecordDto } from './dto/upsert-consultation-record.dto'
import { CreatePrescriptionDto } from './dto/create-prescription.dto'

@Injectable()
export class ConsultationsService {
  constructor(
    private prisma: PrismaService,
    private appointments: AppointmentsService,
  ) {}

  // Authorize the requester as the doctor on the appointment, and return it.
  // getOne enforces ownership (throws ForbiddenException for a different doctor).
  private async assertDoctorAppointment(clerkId: string, appointmentId: string) {
    const appointment = await this.appointments.getOne(clerkId, appointmentId, 'doctor')
    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.COMPLETED
    ) {
      throw new ConflictException(
        'A consultation record can only be added to a confirmed or completed appointment',
      )
    }
    return appointment
  }

  async getRecord(clerkId: string, appointmentId: string, role: string) {
    // getOne authorizes both patient and doctor on the appointment.
    await this.appointments.getOne(clerkId, appointmentId, role)
    return this.prisma.consultationRecord.findUnique({
      where: { appointmentId },
      include: { prescriptions: { orderBy: { createdAt: 'asc' } } },
    })
  }

  async createRecord(clerkId: string, appointmentId: string, dto: UpsertConsultationRecordDto) {
    await this.assertDoctorAppointment(clerkId, appointmentId)

    const existing = await this.prisma.consultationRecord.findUnique({ where: { appointmentId } })
    if (existing) {
      throw new ConflictException('A consultation record already exists for this appointment')
    }

    return this.prisma.consultationRecord.create({
      data: { appointmentId, notes: dto.notes },
      include: { prescriptions: true },
    })
  }

  async updateRecord(clerkId: string, appointmentId: string, dto: UpsertConsultationRecordDto) {
    await this.assertDoctorAppointment(clerkId, appointmentId)

    const existing = await this.prisma.consultationRecord.findUnique({ where: { appointmentId } })
    if (!existing) {
      throw new NotFoundException('No consultation record to update')
    }

    return this.prisma.consultationRecord.update({
      where: { appointmentId },
      data: { notes: dto.notes },
      include: { prescriptions: { orderBy: { createdAt: 'asc' } } },
    })
  }

  async addPrescription(clerkId: string, appointmentId: string, dto: CreatePrescriptionDto) {
    await this.assertDoctorAppointment(clerkId, appointmentId)

    // Create the record on the fly if the doctor adds a prescription first.
    const record = await this.prisma.consultationRecord.upsert({
      where: { appointmentId },
      create: { appointmentId },
      update: {},
    })

    await this.prisma.prescription.create({
      data: { consultationRecordId: record.id, ...dto },
    })

    return this.prisma.consultationRecord.findUnique({
      where: { appointmentId },
      include: { prescriptions: { orderBy: { createdAt: 'asc' } } },
    })
  }

  /**
   * Cross-module read for the reminders scheduler: return prescriptions created
   * on/after `createdAfter` whose appointment is CONFIRMED or COMPLETED, with
   * the owning patient id attached. The consultations module owns prescription
   * data, so other modules must call this rather than querying the table.
   */
  async listPrescriptionsForReminders(createdAfter: Date) {
    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        createdAt: { gte: createdAfter },
        consultationRecord: {
          appointment: {
            status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED] },
          },
        },
      },
      include: {
        consultationRecord: {
          select: { appointment: { select: { patientId: true } } },
        },
      },
    })

    return prescriptions.map((rx) => ({
      id: rx.id,
      medicationName: rx.medicationName,
      dosage: rx.dosage,
      frequency: rx.frequency,
      duration: rx.duration,
      createdAt: rx.createdAt,
      patientId: rx.consultationRecord.appointment.patientId,
    }))
  }
}
