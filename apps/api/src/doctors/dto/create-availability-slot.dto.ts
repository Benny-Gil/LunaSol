import { IsDateString } from 'class-validator'

export class CreateAvailabilitySlotDto {
  @IsDateString()
  startTime!: string

  @IsDateString()
  endTime!: string
}
