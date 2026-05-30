import { IsString, IsOptional, IsObject, IsIn } from 'class-validator'
import type { MessageAttachmentType, MessageAttachmentData } from '@lunasol/types'

const ATTACHMENT_TYPES: MessageAttachmentType[] = [
  'PRESCRIPTION',
  'NOTE',
  'APPOINTMENT',
  'AI_SUGGESTION',
  'SYMPTOM',
]

export class SendMessageDto {
  @IsOptional()
  @IsString()
  body?: string

  @IsOptional()
  @IsIn(ATTACHMENT_TYPES)
  attachmentType?: MessageAttachmentType

  // Polymorphic snapshot — kept intact by ValidationPipe via @IsObject(); the
  // service validates the shape per attachmentType.
  @IsOptional()
  @IsObject()
  attachment?: MessageAttachmentData

  @IsOptional()
  @IsString()
  refId?: string
}
