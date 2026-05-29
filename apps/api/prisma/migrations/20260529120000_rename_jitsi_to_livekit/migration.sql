-- Rename the video room column from the legacy Jitsi name to LiveKit.
-- RENAME preserves existing data (vs. drop + add).
ALTER TABLE "Appointment" RENAME COLUMN "jitsiRoom" TO "livekitRoom";
