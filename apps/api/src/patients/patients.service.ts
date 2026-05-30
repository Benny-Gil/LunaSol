import { Injectable, NotFoundException } from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Injectable()
export class PatientsService {
  private clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  constructor(private prisma: PrismaService) {}

  async getProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })

    if (!user?.patient) {
      throw new NotFoundException('Patient profile not found')
    }

    const profile = user.patient
    const profileComplete = profile.weight > 0 && profile.height > 0

    return { ...profile, profileComplete }
  }

  // Ensures a User + PatientProfile row exists, creating it if the webhook hasn't fired yet.
  private async ensurePatientRecord(clerkId: string) {
    let user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })

    if (!user) {
      const clerkUser = await this.clerk.users.getUser(clerkId)
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
      user = await this.prisma.user.create({
        data: {
          clerkId,
          email,
          role: 'PATIENT',
          patient: {
            create: { name: '', birthday: new Date('1990-01-01'), weight: 0, height: 0 },
          },
        },
        include: { patient: true },
      })
      await this.clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: { role: 'patient' },
      })
    } else if (!user.patient) {
      await this.prisma.patientProfile.create({
        data: { userId: user.id, name: '', birthday: new Date('1990-01-01'), weight: 0, height: 0 },
      })
      user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: { patient: true },
      })
    }

    return user!
  }

  async updateProfile(clerkId: string, dto: UpdateProfileDto) {
    const user = await this.ensurePatientRecord(clerkId)
    const current = user.patient!

    const data: Record<string, any> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.birthday !== undefined) data.birthday = new Date(dto.birthday)
    if (dto.weight !== undefined) data.weight = dto.weight
    if (dto.height !== undefined) data.height = dto.height
    if (dto.phone !== undefined) data.phone = dto.phone
    if (dto.address !== undefined) data.address = dto.address
    if (dto.medicalHistory !== undefined) data.medicalHistory = dto.medicalHistory

    const updated = await this.prisma.patientProfile.update({
      where: { id: current.id },
      data,
    })

    // Snapshot a metric row whenever weight or height actually changes, so the
    // patient health dashboard can plot the trend over time.
    const weightChanged = dto.weight !== undefined && dto.weight !== current.weight
    const heightChanged = dto.height !== undefined && dto.height !== current.height
    if ((weightChanged || heightChanged) && updated.weight > 0 && updated.height > 0) {
      await this.prisma.patientMetric.create({
        data: {
          patientId: updated.id,
          weight: updated.weight,
          height: updated.height,
        },
      })
    }

    const profileComplete = updated.weight > 0 && updated.height > 0
    return { ...updated, profileComplete }
  }

  // Returns the requesting patient's weight/height history, oldest first.
  async getMetrics(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })

    if (!user?.patient) {
      throw new NotFoundException('Patient profile not found')
    }

    return this.prisma.patientMetric.findMany({
      where: { patientId: user.patient.id },
      orderBy: { recordedAt: 'asc' },
    })
  }

  async updatePicture(clerkId: string, filename: string) {
    const user = await this.ensurePatientRecord(clerkId)

    const updated = await this.prisma.patientProfile.update({
      where: { id: user.patient!.id },
      data: { profilePictureUrl: `/api/uploads/profile-pictures/${filename}` },
    })

    const profileComplete = updated.weight > 0 && updated.height > 0
    return { ...updated, profileComplete }
  }
}
