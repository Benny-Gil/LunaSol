import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../prisma/prisma.service'
import { BookAppointmentDto } from './dto/book-appointment.dto'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'
import { AppointmentStatus } from '@prisma/client'

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

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
    await this.prisma.notification.create({
      data: { recipientId, type, message },
    })
  }

  async book(clerkId: string, dto: BookAppointmentDto) {
    const { user: patientUser, patient } = await this.getPatientProfile(clerkId)

    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: dto.slotId },
      include: { appointment: true, doctor: { include: { user: true } } },
    })

    if (!slot) throw new NotFoundException('Slot not found')
    if (slot.isBlocked) throw new ConflictException('Slot is blocked')
    if (slot.appointment) throw new ConflictException('Slot is already booked')
    if (slot.startTime <= new Date()) throw new BadRequestException('Slot is in the past')

    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: slot.doctorId,
        slotId: slot.id,
        status: AppointmentStatus.PENDING,
      },
      include: {
        slot: true,
        doctor: true,
        patient: true,
      },
    })

    // Notify doctor of new appointment request
    await this.createNotification(
      slot.doctor.user.id,
      'APPOINTMENT_REQUEST',
      `New appointment request from ${patient.name} on ${slot.startTime.toLocaleDateString()}`,
    )

    return appointment
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
      include: { slot: true, doctor: true },
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

    const newSlot = await this.prisma.availabilitySlot.findUnique({
      where: { id: dto.newSlotId },
      include: { appointment: true },
    })

    if (!newSlot) throw new NotFoundException('New slot not found')
    if (newSlot.doctorId !== appointment.doctorId) throw new BadRequestException('Slot belongs to a different doctor')
    if (newSlot.isBlocked) throw new ConflictException('New slot is blocked')
    if (newSlot.appointment) throw new ConflictException('New slot is already booked')
    if (newSlot.startTime <= new Date()) throw new BadRequestException('New slot is in the past')

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { slotId: dto.newSlotId },
      include: { slot: true, doctor: true },
    })

    await this.createNotification(
      appointment.doctor.user.id,
      'APPOINTMENT_RESCHEDULED',
      `${patient.name} rescheduled their appointment to ${newSlot.startTime.toLocaleDateString()}`,
    )

    return updated
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

    const jitsiRoom = `lunasol-${randomUUID().replace(/-/g, '').slice(0, 12)}`

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CONFIRMED, jitsiRoom },
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
}
