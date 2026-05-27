import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Injectable()
export class PatientsService {
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

  async updateProfile(clerkId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })

    if (!user?.patient) {
      throw new NotFoundException('Patient profile not found')
    }

    const data: Record<string, any> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.birthday !== undefined) data.birthday = new Date(dto.birthday)
    if (dto.weight !== undefined) data.weight = dto.weight
    if (dto.height !== undefined) data.height = dto.height
    if (dto.phone !== undefined) data.phone = dto.phone
    if (dto.address !== undefined) data.address = dto.address
    if (dto.medicalHistory !== undefined) data.medicalHistory = dto.medicalHistory

    const updated = await this.prisma.patientProfile.update({
      where: { id: user.patient.id },
      data,
    })

    const profileComplete = updated.weight > 0 && updated.height > 0
    return { ...updated, profileComplete }
  }

  async updatePicture(clerkId: string, filename: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { patient: true },
    })

    if (!user?.patient) {
      throw new NotFoundException('Patient profile not found')
    }

    const updated = await this.prisma.patientProfile.update({
      where: { id: user.patient.id },
      data: { profilePictureUrl: `/api/uploads/profile-pictures/${filename}` },
    })

    const profileComplete = updated.weight > 0 && updated.height > 0
    return { ...updated, profileComplete }
  }
}
