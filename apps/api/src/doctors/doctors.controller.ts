import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { mkdirSync } from 'fs'
import { extname, join } from 'path'
import { Roles } from '../auth/decorators/roles.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { DoctorsService } from './doctors.service'
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto'

const uploadDir = join(process.cwd(), 'uploads', 'profile-pictures')
mkdirSync(uploadDir, { recursive: true })

const profilePictureStorage = diskStorage({
  destination: uploadDir,
  filename: (_req: any, file, cb) => {
    const userId = _req.user?.id || 'unknown'
    const ext = extname(file.originalname)
    cb(null, `${userId}-${Date.now()}${ext}`)
  },
})

@Controller('doctors')
export class DoctorsController {
  constructor(private doctorsService: DoctorsService) {}

  @Public()
  @Get()
  async listDoctors() {
    return this.doctorsService.listDoctors()
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

  @Public()
  @Get(':id')
  async getDoctorById(@Param('id') id: string) {
    return this.doctorsService.getDoctorById(id)
  }
}
