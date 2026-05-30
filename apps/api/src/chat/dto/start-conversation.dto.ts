import { IsString, IsOptional } from 'class-validator'

export class StartConversationDto {
  /** Provided by a patient to open the thread with a doctor (DoctorProfile id). */
  @IsOptional()
  @IsString()
  doctorId?: string

  /** Provided by a doctor to open the thread with a patient (PatientProfile id). */
  @IsOptional()
  @IsString()
  patientId?: string
}
