import { IsString, IsOptional } from 'class-validator'

export class UpdateDoctorProfileDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  specialization?: string

  @IsOptional()
  @IsString()
  bio?: string

  @IsOptional()
  @IsString()
  contactDetails?: string
}
