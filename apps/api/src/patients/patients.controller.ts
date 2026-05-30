import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Req,
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
import { PatientsService } from './patients.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

const uploadDir = join(process.cwd(), 'uploads', 'profile-pictures')

const profilePictureStorage = diskStorage({
  destination: uploadDir,
  filename: (_req: any, file, cb) => {
    const userId = _req.user?.id || 'unknown'
    const ext = extname(file.originalname)
    cb(null, `${userId}-${Date.now()}${ext}`)
  },
})

@Controller('patients')
@Roles('patient')
export class PatientsController implements OnModuleInit {
  constructor(private patientsService: PatientsService) {}

  onModuleInit() {
    mkdirSync(uploadDir, { recursive: true })
  }

  @Get('me')
  async getProfile(@Req() req: any) {
    return this.patientsService.getProfile(req.user.id)
  }

  @Get('me/metrics')
  async getMetrics(@Req() req: any) {
    return this.patientsService.getMetrics(req.user.id)
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.patientsService.updateProfile(req.user.id, dto)
  }

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
    return this.patientsService.updatePicture(req.user.id, file.filename)
  }
}
