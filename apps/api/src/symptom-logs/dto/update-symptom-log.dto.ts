import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator'
import { SymptomSeverity } from '@prisma/client'

export class UpdateSymptomLogDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string

  @IsOptional()
  @IsEnum(SymptomSeverity)
  severity?: SymptomSeverity

  @IsOptional()
  @IsDateString()
  loggedAt?: string
}
