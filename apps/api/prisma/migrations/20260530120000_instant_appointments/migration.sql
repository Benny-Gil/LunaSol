-- Instant (on-demand) appointments.
-- Doctors opt in via `acceptingInstant`; instant appointments have no pre-booked
-- slot, so `slotId` becomes nullable and `isInstant` flags the on-demand flow.

-- DoctorProfile: opt-in presence toggle.
ALTER TABLE "DoctorProfile" ADD COLUMN "acceptingInstant" BOOLEAN NOT NULL DEFAULT false;

-- Appointment: slot is now optional; add the instant flag.
ALTER TABLE "Appointment" ADD COLUMN "isInstant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ALTER COLUMN "slotId" DROP NOT NULL;
