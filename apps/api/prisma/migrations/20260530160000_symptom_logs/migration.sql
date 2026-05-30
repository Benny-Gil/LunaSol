-- Patient-owned symptom history log, shareable with a treating doctor.

-- CreateEnum
CREATE TYPE "SymptomSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateTable
CREATE TABLE "SymptomLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "SymptomSeverity" NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SymptomLog_patientId_loggedAt_idx" ON "SymptomLog"("patientId", "loggedAt");

-- AddForeignKey
ALTER TABLE "SymptomLog" ADD CONSTRAINT "SymptomLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
