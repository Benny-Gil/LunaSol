import { IsString, IsOptional } from 'class-validator'

export class UpsertConsultationRecordDto {
  @IsOptional()
  @IsString()
  notes?: string
}
