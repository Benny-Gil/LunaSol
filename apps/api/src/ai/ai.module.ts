import { Module } from '@nestjs/common'
import { DoctorsModule } from '../doctors/doctors.module'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [DoctorsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
