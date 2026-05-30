import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator'
import { SymptomSeverity } from '@prisma/client'

export class CreateSymptomLogDto {
  @IsString()
  @IsNotEmpty()
  description!: string

  @IsEnum(SymptomSeverity)
  severity!: SymptomSeverity

  @IsOptional()
  @IsDateString()
  loggedAt?: string
}
