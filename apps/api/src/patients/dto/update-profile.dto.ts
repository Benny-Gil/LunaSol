import { IsString, IsOptional, IsNumber, IsDateString, Min } from 'class-validator'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsDateString()
  birthday?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  medicalHistory?: string
}
