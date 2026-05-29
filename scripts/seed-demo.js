// Idempotent demo seed: creates real Clerk accounts (email + password + role)
// and matching complete DB profiles + availability. Safe to re-run.
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

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

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

function slotsForDoctor() {
  // 3 x 30-min slots/day at 09:00/10:00/11:00 UTC for the next 7 days.
  const slots = []
  for (let day = 1; day <= 7; day++) {
    for (const hour of [9, 10, 11]) {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() + day)
      start.setUTCHours(hour, 0, 0, 0)
      const end = new Date(start)
      end.setUTCMinutes(30)
      slots.push({ startTime: start, endTime: end })
    }
  }
  return slots
}

async function main() {
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
  }

  for (const acct of PATIENTS) {
    console.log(`Patient: ${acct.name}`)
    const clerkId = await ensureClerkUser(acct, 'patient')
    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { email: acct.email, role: 'PATIENT' },
      create: { clerkId, email: acct.email, role: 'PATIENT' },
    })
    await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: { name: acct.name, birthday: acct.birthday, weight: acct.weight, height: acct.height, phone: acct.phone, address: acct.address, medicalHistory: acct.medicalHistory },
      create: { userId: user.id, name: acct.name, birthday: acct.birthday, weight: acct.weight, height: acct.height, phone: acct.phone, address: acct.address, medicalHistory: acct.medicalHistory },
    })
  }

  console.log('\nDemo seed complete.')
  await prisma.$disconnect()
  await pool.end()
}

main().catch(async (e) => {
  console.error('Seed failed:', e)
  await prisma.$disconnect().catch(() => {})
  await pool.end().catch(() => {})
  process.exit(1)
})
