import { IsString, IsNotEmpty } from 'class-validator'

export class RescheduleAppointmentDto {
  @IsString()
  @IsNotEmpty()
  newSlotId!: string
}
