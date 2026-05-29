import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Req,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { mkdirSync } from 'fs'
import { extname, join } from 'path'
import { Roles } from '../auth/decorators/roles.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { DoctorsService } from './doctors.service'
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto'
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto'

const uploadDir = join(process.cwd(), 'uploads', 'profile-pictures')

const profilePictureStorage = diskStorage({
  destination: uploadDir,
  filename: (_req: any, file, cb) => {
    const userId = _req.user?.id || 'unknown'
    const ext = extname(file.originalname)
    cb(null, `${userId}-${Date.now()}${ext}`)
  },
})

@Controller('doctors')
export class DoctorsController implements OnModuleInit {
  constructor(private doctorsService: DoctorsService) {}

  onModuleInit() {
    mkdirSync(uploadDir, { recursive: true })
  }

  @Public()
  @Get()
  async listDoctors(
    @Query('specialization') specialization?: string,
    @Query('search') search?: string,
    @Query('available') available?: string,
  ) {
    return this.doctorsService.listDoctors({
      specialization,
      search,
      available: available === 'true',
    })
  }

  @Roles('doctor')
  @Get('me')
  async getProfile(@Req() req: any) {
    return this.doctorsService.getProfile(req.user.id)
  }

  @Roles('doctor')
  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateDoctorProfileDto) {
    return this.doctorsService.updateProfile(req.user.id, dto)
  }

  @Roles('doctor')
  @Post('me/picture')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: profilePictureStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false)
          return
        }
        cb(null, true)
      },
    }),
  )
  async uploadPicture(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded')
    }
    return this.doctorsService.updatePicture(req.user.id, file.filename)
  }

  @Roles('doctor')
  @Get('me/availability')
  async listOwnAvailability(@Req() req: any) {
    return this.doctorsService.listOwnAvailability(req.user.id)
  }

  @Roles('doctor')
  @Post('me/availability')
  async createAvailabilitySlot(@Req() req: any, @Body() dto: CreateAvailabilitySlotDto) {
    return this.doctorsService.createAvailabilitySlot(req.user.id, dto)
  }

  @Roles('doctor')
  @Patch('me/availability/:id/block')
  async blockSlot(@Req() req: any, @Param('id') id: string) {
    return this.doctorsService.setSlotBlocked(req.user.id, id, true)
  }

  @Roles('doctor')
  @Patch('me/availability/:id/unblock')
  async unblockSlot(@Req() req: any, @Param('id') id: string) {
    return this.doctorsService.setSlotBlocked(req.user.id, id, false)
  }

  @Roles('doctor')
  @Delete('me/availability/:id')
  async deleteSlot(@Req() req: any, @Param('id') id: string) {
    return this.doctorsService.deleteAvailabilitySlot(req.user.id, id)
  }

  @Public()
  @Get(':id')
  async getDoctorById(@Param('id') id: string) {
    return this.doctorsService.getDoctorById(id)
  }

  @Public()
  @Get(':id/availability')
  async getDoctorAvailability(@Param('id') id: string) {
    return this.doctorsService.getDoctorAvailability(id)
  }
}
