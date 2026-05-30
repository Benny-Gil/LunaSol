import { IsBoolean } from 'class-validator'

export class UpdateInstantDto {
  @IsBoolean()
  acceptingInstant!: boolean
}
