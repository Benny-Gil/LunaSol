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

  async listDoctors() {
    const doctors = await this.prisma.doctorProfile.findMany({
      select: {
        id: true,
        name: true,
        specialization: true,
        bio: true,
        profilePictureUrl: true,
        contactDetails: true,
      },
    })
    return doctors
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
