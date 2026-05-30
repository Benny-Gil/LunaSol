import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { ConsultationsService } from '../consultations/consultations.service'
import {
  parseSchedule,
  isActive,
  currentDoseWindowStart,
} from './schedule.util'

const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name)

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private consultations: ConsultationsService,
  ) {}

  private async getPatientProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })
    if (!user?.patient) throw new NotFoundException('Patient profile not found')
    return { user, patient: user.patient }
  }

  /** Patient endpoint: list this patient's reminders (most recent first). */
  async listMine(clerkId: string) {
    const { patient } = await this.getPatientProfile(clerkId)
    return this.prisma.medicationReminder.findMany({
      where: { patientId: patient.id },
      orderBy: { scheduledFor: 'desc' },
      take: 100,
      include: {
        prescription: {
          select: {
            id: true,
            medicationName: true,
            dosage: true,
            frequency: true,
            duration: true,
            notes: true,
          },
        },
      },
    })
  }

  /** Patient endpoint: mark a reminder as taken (ack). */
  async markTaken(clerkId: string, id: string) {
    const { patient } = await this.getPatientProfile(clerkId)
    const reminder = await this.prisma.medicationReminder.findUnique({ where: { id } })
    if (!reminder) throw new NotFoundException('Reminder not found')
    if (reminder.patientId !== patient.id) throw new ForbiddenException('Not your reminder')

    return this.prisma.medicationReminder.update({
      where: { id },
      data: { taken: true, takenAt: new Date() },
    })
  }

  /**
   * Hourly scheduler. Finds active prescriptions whose current dose-window has
   * no reminder yet, records one, and pushes an in-app notification. The unique
   * [prescriptionId, scheduledFor] constraint makes this idempotent: a duplicate
   * run in the same window is a no-op. Wrapped so the cron callback never throws.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runDueReminders(now: Date = new Date()): Promise<number> {
    try {
      // Look back as far as the longest possible course so long prescriptions
      // are still considered; per-prescription isActive() trims the rest.
      const createdAfter = new Date(now.getTime() - MAX_DURATION_MS)
      const prescriptions = await this.consultations.listPrescriptionsForReminders(createdAfter)

      let sent = 0
      for (const rx of prescriptions) {
        const { dosesPerDay, durationDays } = parseSchedule(rx.frequency, rx.duration)
        if (!isActive(rx.createdAt, durationDays, now)) continue

        const scheduledFor = currentDoseWindowStart(now, dosesPerDay)
        const created = await this.recordReminderIfDue(rx, scheduledFor)
        if (created) sent++
      }
      if (sent > 0) this.logger.log(`Sent ${sent} medication reminder(s)`)
      return sent
    } catch (err: any) {
      this.logger.error(`Reminder run failed: ${err?.message ?? err}`)
      return 0
    }
  }

  /**
   * Create a reminder + notification for this dose-window, unless one already
   * exists (dedup). Returns true if a new reminder was created.
   */
  private async recordReminderIfDue(
    rx: { id: string; medicationName: string; dosage: string; patientId: string },
    scheduledFor: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.medicationReminder.findUnique({
      where: { prescriptionId_scheduledFor: { prescriptionId: rx.id, scheduledFor } },
      select: { id: true },
    })
    if (existing) return false

    try {
      await this.prisma.medicationReminder.create({
        data: { prescriptionId: rx.id, patientId: rx.patientId, scheduledFor },
      })
    } catch (err: any) {
      // Lost a race with a concurrent run — treated as already-sent.
      if (err?.code === 'P2002') return false
      throw err
    }

    await this.notifyPatient(rx.patientId, `Time to take your ${rx.medicationName} (${rx.dosage}).`)
    return true
  }

  /** Persist a Notification row and emit it over Socket.IO to the patient. */
  private async notifyPatient(patientProfileId: string, message: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: patientProfileId },
      select: { userId: true },
    })
    if (!profile) return

    const notification = await this.prisma.notification.create({
      data: { recipientId: profile.userId, type: 'MEDICATION_REMINDER', message },
    })
    this.notifications.emitToUser(profile.userId, 'notification', {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      createdAt: notification.createdAt,
    })
  }
}
