import { IsString, IsNotEmpty } from 'class-validator'

export class BookAppointmentDto {
  @IsString()
  @IsNotEmpty()
  slotId: string
}
