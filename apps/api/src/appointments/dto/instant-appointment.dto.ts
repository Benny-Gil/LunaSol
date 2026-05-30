import { IsString, IsNotEmpty } from 'class-validator'

export class InstantAppointmentDto {
  @IsString()
  @IsNotEmpty()
  doctorId!: string
}
