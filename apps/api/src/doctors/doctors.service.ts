import { Injectable, NotFoundException } from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto'

@Injectable()
export class DoctorsService {
  private clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  constructor(private prisma: PrismaService) {}

  async getProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { doctor: true },
    })

    if (!user?.doctor) {
      throw new NotFoundException('Doctor profile not found')
    }

    const profile = user.doctor
    const profileComplete = !!profile.bio && profile.bio.trim().length > 0

    return { ...profile, profileComplete }
  }

  async listDoctors(filters: { specialization?: string; search?: string; available?: boolean } = {}) {
    const now = new Date()
    const conditions: any[] = []

    if (filters.specialization) {
      conditions.push({ specialization: { contains: filters.specialization, mode: 'insensitive' } })
    }

    if (filters.search) {
      conditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { specialization: { contains: filters.search, mode: 'insensitive' } },
        ],
      })
    }

    if (filters.available) {
      conditions.push({
        slots: { some: { isBlocked: false, appointment: null, startTime: { gte: now } } },
      })
    }

    return this.prisma.doctorProfile.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      select: {
        id: true,
        name: true,
        specialization: true,
        bio: true,
        profilePictureUrl: true,
        contactDetails: true,
      },
    })
  }

  async getDoctorById(id: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        specialization: true,
        bio: true,
        profilePictureUrl: true,
        contactDetails: true,
      },
    })

    if (!doctor) {
      throw new NotFoundException('Doctor not found')
    }

    return doctor
  }

  async getDoctorAvailability(id: string) {
    const doctor = await this.prisma.doctorProfile.findUnique({ where: { id } })
    if (!doctor) throw new NotFoundException('Doctor not found')

    const now = new Date()
    const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    return this.prisma.availabilitySlot.findMany({
      where: {
        doctorId: id,
        isBlocked: false,
        appointment: null,
        startTime: { gte: now, lte: cutoff },
      },
      select: { id: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    })
  }

  private async ensureDoctorRecord(clerkId: string) {
    let user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { doctor: true },
    })

    if (!user) {
      const clerkUser = await this.clerk.users.getUser(clerkId)
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
      user = await this.prisma.user.create({
        data: {
          clerkId,
          email,
          role: 'DOCTOR',
          doctor: {
            create: { name: '', specialization: 'General Medicine' },
          },
        },
        include: { doctor: true },
      })
      await this.clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: { role: 'doctor' },
      })
    } else if (!user.doctor) {
      await this.prisma.doctorProfile.create({
        data: { userId: user.id, name: '', specialization: 'General Medicine' },
      })
      user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: { doctor: true },
      })
    }

    return user!
  }

  async updateProfile(clerkId: string, dto: UpdateDoctorProfileDto) {
    const user = await this.ensureDoctorRecord(clerkId)

    const data: Record<string, any> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.specialization !== undefined) data.specialization = dto.specialization
    if (dto.bio !== undefined) data.bio = dto.bio
    if (dto.contactDetails !== undefined) data.contactDetails = dto.contactDetails

    const updated = await this.prisma.doctorProfile.update({
      where: { id: user.doctor!.id },
      data,
    })

    const profileComplete = !!updated.bio && updated.bio.trim().length > 0
    return { ...updated, profileComplete }
  }

  async updatePicture(clerkId: string, filename: string) {
    const user = await this.ensureDoctorRecord(clerkId)

    const updated = await this.prisma.doctorProfile.update({
      where: { id: user.doctor!.id },
      data: { profilePictureUrl: `/api/uploads/profile-pictures/${filename}` },
    })

    const profileComplete = !!updated.bio && updated.bio.trim().length > 0
    return { ...updated, profileComplete }
  }
}
