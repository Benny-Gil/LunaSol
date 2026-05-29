import { IsString, IsOptional } from 'class-validator'

export class CreatePrescriptionDto {
  @IsString()
  medicationName!: string

  @IsString()
  dosage!: string

  @IsString()
  frequency!: string

  @IsString()
  duration!: string

  @IsOptional()
  @IsString()
  notes?: string
}
