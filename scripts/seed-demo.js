// Idempotent demo seed: creates real Clerk accounts (email + password + role)
// and matching complete DB profiles + availability + appointments, consultation
// records, prescriptions and notifications. Safe to re-run.
// Run inside the prod api container (has @prisma/client, @clerk/backend,
// DATABASE_URL and CLERK_SECRET_KEY).
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')
const { createClerkClient } = require('@clerk/backend')

const PASSWORD = 'LunaSolDemo2026!'

const DOCTORS = [
  {
    email: 'dr.santos@lunasoldemo.com',
    firstName: 'Maria',
    lastName: 'Santos',
    name: 'Dr. Maria Santos',
    specialization: 'General Practice',
    bio: 'Board-certified family medicine physician with 12 years of experience in primary care, preventive medicine, and chronic disease management.',
    contactDetails: '+63 917 100 0001',
  },
  {
    email: 'dr.reyes@lunasoldemo.com',
    firstName: 'Carlos',
    lastName: 'Reyes',
    name: 'Dr. Carlos Reyes',
    specialization: 'Cardiology',
    bio: 'Interventional cardiologist specializing in heart failure, arrhythmia management, and preventive cardiology.',
    contactDetails: '+63 917 100 0002',
  },
]

const PATIENTS = [
  {
    email: 'juan.patient@lunasoldemo.com',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    name: 'Juan Dela Cruz',
    birthday: new Date('1990-04-12'),
    weight: 72.5,
    height: 175,
    phone: '+63 917 200 0001',
    address: '123 Mabini St, Manila',
    medicalHistory: 'Mild hypertension, managed with lifestyle changes.',
  },
  {
    email: 'ana.patient@lunasoldemo.com',
    firstName: 'Ana',
    lastName: 'Rivera',
    name: 'Ana Rivera',
    birthday: new Date('1995-09-28'),
    weight: 58,
    height: 162,
    phone: '+63 917 200 0002',
    address: '45 Rizal Ave, Quezon City',
    medicalHistory: 'No significant medical history. Seasonal allergies.',
  },
]

// One completed consultation per patient↔doctor pair (index-aligned with the
// arrays above). Notes + prescriptions are specialization-appropriate.
const CONSULTATIONS = [
  {
    notes:
      'Patient presented with persistent dry cough for 2 weeks. Lungs clear on auscultation. Likely post-nasal drip secondary to allergic rhinitis. Advised saline nasal rinse and follow-up in 2 weeks if symptoms persist.',
    prescriptions: [
      {
        medicationName: 'Cetirizine',
        dosage: '10mg',
        frequency: 'Once daily at bedtime',
        duration: '14 days',
        notes: 'Take with water. May cause drowsiness.',
      },
      {
        medicationName: 'Fluticasone Nasal Spray',
        dosage: '50mcg/spray, 2 sprays per nostril',
        frequency: 'Once daily in the morning',
        duration: '30 days',
        notes: 'Shake well before use. Avoid spraying towards nasal septum.',
      },
    ],
  },
  {
    notes:
      'Routine cardiac follow-up. Blood pressure 130/85 mmHg. ECG shows normal sinus rhythm. Lipid panel results reviewed — LDL slightly elevated at 140 mg/dL. Lifestyle modifications discussed. Consider statin therapy at next visit if no improvement.',
    prescriptions: [
      {
        medicationName: 'Losartan',
        dosage: '50mg',
        frequency: 'Once daily in the morning',
        duration: '90 days',
        notes: 'Continue current dose. Monitor blood pressure weekly.',
      },
    ],
  },
]

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// ─── Date helpers ───────────────────────────────────────────────────────────

/** A Date `days` from now at the given UTC hour. */
function futureDate(days, hour) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, 0, 0, 0)
  return d
}

/** A Date `days` in the past at the given UTC hour. */
function pastDate(days, hour) {
  return futureDate(-days, hour)
}

// ─── Clerk ──────────────────────────────────────────────────────────────────

async function ensureClerkUser(acct, role) {
  const existing = await clerk.users.getUserList({ emailAddress: [acct.email] })
  let user = existing.data?.[0]
  if (!user) {
    user = await clerk.users.createUser({
      emailAddress: [acct.email],
      password: PASSWORD,
      firstName: acct.firstName,
      lastName: acct.lastName,
      publicMetadata: { role },
      unsafeMetadata: { role },
      skipPasswordChecks: true,
    })
    console.log(`  created Clerk user ${acct.email} (${user.id})`)
  } else {
    await clerk.users.updateUserMetadata(user.id, { publicMetadata: { role } })
    console.log(`  reused Clerk user ${acct.email} (${user.id})`)
  }
  return user.id
}

// ─── Idempotent DB helpers ──────────────────────────────────────────────────

function slotsForDoctor() {
  // 3 x 30-min slots/day at 09:00/10:00/11:00 UTC for the next 7 days.
  const slots = []
  for (let day = 1; day <= 7; day++) {
    for (const hour of [9, 10, 11]) {
      const start = futureDate(day, hour)
      const end = new Date(start)
      end.setUTCMinutes(30)
      slots.push({ startTime: start, endTime: end })
    }
  }
  return slots
}

/** Find (or create) a slot for a doctor at a specific start time. */
async function ensureSlotAt(doctorId, startTime, endTime, isBlocked = false) {
  const existing = await prisma.availabilitySlot.findFirst({
    where: { doctorId, startTime },
  })
  if (existing) return existing
  return prisma.availabilitySlot.create({
    data: { doctorId, startTime, endTime, isBlocked },
  })
}

/** Upsert an appointment keyed by its (unique) slot. */
function ensureAppointment(slotId, data) {
  return prisma.appointment.upsert({
    where: { slotId },
    update: data,
    create: { slotId, ...data },
  })
}

/** Upsert a consultation record (keyed by its unique appointment) and replace
 *  its prescriptions so re-runs stay deterministic. */
async function ensureConsultationRecord(appointmentId, notes, prescriptions) {
  const record = await prisma.consultationRecord.upsert({
    where: { appointmentId },
    update: { notes },
    create: { appointmentId, notes },
  })
  await prisma.prescription.deleteMany({ where: { consultationRecordId: record.id } })
  await prisma.prescription.createMany({
    data: prescriptions.map((p) => ({ ...p, consultationRecordId: record.id })),
  })
  return record
}

/** Create a notification only if an identical one doesn't already exist. */
async function ensureNotification({ recipientId, type, message, isRead }) {
  const existing = await prisma.notification.findFirst({
    where: { recipientId, type, message },
  })
  if (existing) return existing
  return prisma.notification.create({
    data: { recipientId, type, message, isRead },
  })
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const doctorProfiles = []
  const doctorUsers = []
  const patientProfiles = []
  const patientUsers = []

  // ── Doctors ───────────────────────────────────────────────────────────────
  for (const acct of DOCTORS) {
    console.log(`Doctor: ${acct.name}`)
    const clerkId = await ensureClerkUser(acct, 'doctor')
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email: acct.email, role: 'DOCTOR' },
      create: { clerkId, email: acct.email, role: 'DOCTOR' },
    })
    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: { name: acct.name, bio: acct.bio, specialization: acct.specialization, contactDetails: acct.contactDetails },
      create: { userId: user.id, name: acct.name, bio: acct.bio, specialization: acct.specialization, contactDetails: acct.contactDetails },
    })
    const slotCount = await prisma.availabilitySlot.count({ where: { doctorId: profile.id } })
    if (slotCount === 0) {
      await prisma.availabilitySlot.createMany({
        data: slotsForDoctor().map((s) => ({ ...s, doctorId: profile.id })),
      })
      console.log(`  added ${slotsForDoctor().length} availability slots`)
    } else {
      console.log(`  already has ${slotCount} slots, skipping`)
    }
    doctorProfiles.push(profile)
    doctorUsers.push(user)
  }

  // ── Patients ──────────────────────────────────────────────────────────────
  for (const acct of PATIENTS) {
    console.log(`Patient: ${acct.name}`)
    const clerkId = await ensureClerkUser(acct, 'patient')
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email: acct.email, role: 'PATIENT' },
      create: { clerkId, email: acct.email, role: 'PATIENT' },
    })
    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: { name: acct.name, birthday: acct.birthday, weight: acct.weight, height: acct.height, phone: acct.phone, address: acct.address, medicalHistory: acct.medicalHistory },
      create: { userId: user.id, name: acct.name, birthday: acct.birthday, weight: acct.weight, height: acct.height, phone: acct.phone, address: acct.address, medicalHistory: acct.medicalHistory },
    })
    patientProfiles.push(profile)
    patientUsers.push(user)
  }

  // ── Confirmed (upcoming) appointments ───────────────────────────────────────
  // Pair patient[i] ↔ doctor[i] on a deterministic future slot (day 1, 10:00).
  console.log('Confirmed appointments:')
  for (let i = 0; i < PATIENTS.length; i++) {
    const start = futureDate(1, 10)
    const end = new Date(start)
    end.setUTCMinutes(30)
    const slot = await ensureSlotAt(doctorProfiles[i].id, start, end)
    await ensureAppointment(slot.id, {
      patientId: patientProfiles[i].id,
      doctorId: doctorProfiles[i].id,
      status: 'CONFIRMED',
      livekitRoom: `appt-${doctorProfiles[i].id.slice(-6)}-${patientProfiles[i].id.slice(-6)}`,
    })
    console.log(`  ${PATIENTS[i].name} → ${DOCTORS[i].name}`)
  }

  // ── Completed (past) appointments + records + prescriptions ─────────────────
  console.log('Completed consultations:')
  for (let i = 0; i < PATIENTS.length; i++) {
    const start = pastDate(7 - i, 10)
    const end = new Date(start)
    end.setUTCHours(11, 0, 0, 0)
    const slot = await ensureSlotAt(doctorProfiles[i].id, start, end)
    const appointment = await ensureAppointment(slot.id, {
      patientId: patientProfiles[i].id,
      doctorId: doctorProfiles[i].id,
      status: 'COMPLETED',
      livekitRoom: `appt-past-${i + 1}`,
    })
    await ensureConsultationRecord(
      appointment.id,
      CONSULTATIONS[i].notes,
      CONSULTATIONS[i].prescriptions,
    )
    console.log(`  ${PATIENTS[i].name} with ${DOCTORS[i].name} (${CONSULTATIONS[i].prescriptions.length} Rx)`)
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  console.log('Notifications:')
  const notifications = [
    // Patient notifications
    {
      recipientId: patientUsers[0].id,
      type: 'APPOINTMENT_CONFIRMED',
      message: `Your appointment with ${DOCTORS[0].name} has been confirmed.`,
      isRead: false,
    },
    {
      recipientId: patientUsers[0].id,
      type: 'CONSULTATION_COMPLETE',
      message: `${DOCTORS[0].name} has completed your consultation. View your records and prescriptions.`,
      isRead: true,
    },
    {
      recipientId: patientUsers[0].id,
      type: 'PRESCRIPTION_ISSUED',
      message: 'A new prescription has been issued for you. Check your medical records.',
      isRead: true,
    },
    {
      recipientId: patientUsers[1].id,
      type: 'APPOINTMENT_CONFIRMED',
      message: `Your appointment with ${DOCTORS[1].name} has been confirmed.`,
      isRead: false,
    },
    {
      recipientId: patientUsers[1].id,
      type: 'CONSULTATION_COMPLETE',
      message: `${DOCTORS[1].name} has completed your consultation. View your records and prescriptions.`,
      isRead: false,
    },
    // Doctor notifications
    {
      recipientId: doctorUsers[0].id,
      type: 'NEW_APPOINTMENT',
      message: `New appointment booked by ${PATIENTS[0].name}.`,
      isRead: true,
    },
    {
      recipientId: doctorUsers[0].id,
      type: 'APPOINTMENT_REMINDER',
      message: 'Reminder: You have an upcoming appointment tomorrow at 10:00 AM.',
      isRead: false,
    },
    {
      recipientId: doctorUsers[1].id,
      type: 'NEW_APPOINTMENT',
      message: `New appointment booked by ${PATIENTS[1].name}.`,
      isRead: false,
    },
  ]
  for (const n of notifications) {
    await ensureNotification(n)
  }
  console.log(`  ensured ${notifications.length} notifications`)

  // ── Summary ─────────────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    doctorProfiles: await prisma.doctorProfile.count(),
    patientProfiles: await prisma.patientProfile.count(),
    availabilitySlots: await prisma.availabilitySlot.count(),
    appointments: await prisma.appointment.count(),
    consultationRecords: await prisma.consultationRecord.count(),
    prescriptions: await prisma.prescription.count(),
    notifications: await prisma.notification.count(),
  }
  console.log('\nDemo seed complete. Current totals:')
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`)
  }

  await prisma.$disconnect()
  await pool.end()
}

main().catch(async (e) => {
  console.error('Seed failed:', e)
  await prisma.$disconnect().catch(() => {})
  await pool.end().catch(() => {})
  process.exit(1)
})
