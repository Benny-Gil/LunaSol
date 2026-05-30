-- Time-series snapshot of a patient's weight/height, captured on profile updates.
-- Powers the patient health dashboard weight/height trends.

-- CreateTable
CREATE TABLE "PatientMetric" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientMetric_patientId_recordedAt_idx" ON "PatientMetric"("patientId", "recordedAt");

-- AddForeignKey
ALTER TABLE "PatientMetric" ADD CONSTRAINT "PatientMetric_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
