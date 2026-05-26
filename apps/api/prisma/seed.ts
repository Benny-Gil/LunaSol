import 'dotenv/config';
import {
  PrismaClient,
  Role,
  AppointmentStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return a Date offset by `days` from today at the given hour (UTC). */
function futureDate(days: number, hour: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** Return a Date offset by negative `days` from today at the given hour. */
function pastDate(days: number, hour: number): Date {
  return futureDate(-days, hour);
}

// ─── Seed Data Definitions ────────────────────────────────────────────────────

const DOCTORS = [
  {
    clerkId: 'clerk_seed_doctor_1',
    email: 'dr.santos@lunasol.dev',
    name: 'Dr. Maria Santos',
    specialization: 'General Practice',
    bio: 'Board-certified family medicine physician with 12 years of experience in primary care, preventive medicine, and chronic disease management.',
    contactDetails: '+63 917 123 4001',
  },
  {
    clerkId: 'clerk_seed_doctor_2',
    email: 'dr.reyes@lunasol.dev',
    name: 'Dr. Carlos Reyes',
    specialization: 'Cardiology',
    bio: 'Interventional cardiologist specializing in heart failure, arrhythmia management, and preventive cardiology. Fellow of the Philippine Heart Association.',
    contactDetails: '+63 917 123 4002',
  },
  {
    clerkId: 'clerk_seed_doctor_3',
    email: 'dr.lim@lunasol.dev',
    name: 'Dr. Angela Lim',
    specialization: 'Dermatology',
    bio: 'Dermatologist with expertise in acne treatment, cosmetic dermatology, and skin cancer screening. Published researcher in tropical skin disorders.',
    contactDetails: '+63 917 123 4003',
  },
  {
    clerkId: 'clerk_seed_doctor_4',
    email: 'dr.garcia@lunasol.dev',
    name: 'Dr. Jose Garcia',
    specialization: 'Pediatrics',
    bio: 'Pediatrician dedicated to newborn care, childhood immunizations, and developmental assessments. 15 years of clinical experience.',
    contactDetails: '+63 917 123 4004',
  },
  {
    clerkId: 'clerk_seed_doctor_5',
    email: 'dr.navarro@lunasol.dev',
    name: 'Dr. Patricia Navarro',
    specialization: 'Neurology',
    bio: 'Neurologist focused on headache disorders, epilepsy, and neurodegenerative diseases. Trained at the Philippine General Hospital.',
    contactDetails: '+63 917 123 4005',
  },
  {
    clerkId: 'clerk_seed_doctor_6',
    email: 'dr.dela-cruz@lunasol.dev',
    name: 'Dr. Ramon dela Cruz',
    specialization: 'Psychiatry',
    bio: 'Psychiatrist providing evidence-based treatment for anxiety, depression, ADHD, and trauma-related disorders. Advocate for mental health awareness.',
    contactDetails: '+63 917 123 4006',
  },
  {
    clerkId: 'clerk_seed_doctor_7',
    email: 'dr.villanueva@lunasol.dev',
    name: 'Dr. Sofia Villanueva',
    specialization: 'Orthopedics',
    bio: 'Orthopedic surgeon specializing in sports medicine, joint replacement, and minimally-invasive arthroscopic surgery.',
    contactDetails: '+63 917 123 4007',
  },
];

const PATIENTS = [
  {
    clerkId: 'clerk_seed_patient_1',
    email: 'juan.bautista@example.com',
    name: 'Juan Bautista',
    birthday: new Date('1990-03-15'),
    weight: 72.5,
    height: 170,
    phone: '+63 918 555 0001',
    address: '123 Rizal Ave, Makati City',
    medicalHistory: 'Mild asthma diagnosed in childhood. Seasonal allergies. No surgical history.',
  },
  {
    clerkId: 'clerk_seed_patient_2',
    email: 'anna.cruz@example.com',
    name: 'Anna Cruz',
    birthday: new Date('1985-07-22'),
    weight: 58.0,
    height: 160,
    phone: '+63 918 555 0002',
    address: '456 Bonifacio St, Quezon City',
    medicalHistory: 'Type 2 diabetes managed with metformin since 2019. Hypertension controlled with losartan.',
  },
  {
    clerkId: 'clerk_seed_patient_3',
    email: 'miguel.torres@example.com',
    name: 'Miguel Torres',
    birthday: new Date('1998-11-08'),
    weight: 80.0,
    height: 178,
    phone: '+63 918 555 0003',
    address: '789 Mabini Blvd, Pasig City',
    medicalHistory: 'No known chronic conditions. Appendectomy at age 16. Penicillin allergy.',
  },
  {
    clerkId: 'clerk_seed_patient_4',
    email: 'rosa.mendoza@example.com',
    name: 'Rosa Mendoza',
    birthday: new Date('1975-01-30'),
    weight: 65.0,
    height: 155,
    phone: '+63 918 555 0004',
    address: '321 Luna St, Mandaluyong City',
    medicalHistory: 'Hypothyroidism on levothyroxine. History of migraine with aura. Cholecystectomy in 2018.',
  },
];

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database …');

  // ── 1. Clean slate (reverse FK order) ────────────────────────────────────
  console.log('  ✕ Clearing existing data …');
  await prisma.notification.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.consultationRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.user.deleteMany();

  // ── 2. Create doctor users + profiles ────────────────────────────────────
  console.log('  + Creating doctors …');
  const doctorProfiles = [];
  for (const doc of DOCTORS) {
    const user = await prisma.user.create({
      data: {
        clerkId: doc.clerkId,
        email: doc.email,
        role: Role.DOCTOR,
        doctor: {
          create: {
            name: doc.name,
            specialization: doc.specialization,
            bio: doc.bio,
            contactDetails: doc.contactDetails,
          },
        },
      },
      include: { doctor: true },
    });
    doctorProfiles.push(user.doctor!);
  }

  // ── 3. Create patient users + profiles ───────────────────────────────────
  console.log('  + Creating patients …');
  const patientProfiles = [];
  for (const pat of PATIENTS) {
    const user = await prisma.user.create({
      data: {
        clerkId: pat.clerkId,
        email: pat.email,
        role: Role.PATIENT,
        patient: {
          create: {
            name: pat.name,
            birthday: pat.birthday,
            weight: pat.weight,
            height: pat.height,
            phone: pat.phone,
            address: pat.address,
            medicalHistory: pat.medicalHistory,
          },
        },
      },
      include: { patient: true },
    });
    patientProfiles.push(user.patient!);
  }

  // ── 4. Create availability slots ─────────────────────────────────────────
  console.log('  + Creating availability slots …');
  const allSlots: Awaited<ReturnType<typeof prisma.availabilitySlot.create>>[] = [];

  for (const doctor of doctorProfiles) {
    // Create slots for the next 14 days
    for (let day = 1; day <= 14; day++) {
      const hours = [9, 10, 11, 14, 15]; // 5 slots per day
      for (const hour of hours) {
        const slot = await prisma.availabilitySlot.create({
          data: {
            doctorId: doctor.id,
            startTime: futureDate(day, hour),
            endTime: futureDate(day, hour + 1),
            isBlocked: false,
          },
        });
        allSlots.push(slot);
      }

      // 1 blocked slot per day (e.g. lunch break or personal time)
      const blockedSlot = await prisma.availabilitySlot.create({
        data: {
          doctorId: doctor.id,
          startTime: futureDate(day, 12),
          endTime: futureDate(day, 13),
          isBlocked: true,
        },
      });
      allSlots.push(blockedSlot);
    }
  }

  // Also create a few past slots for completed appointments
  const pastSlots = [];
  for (let i = 0; i < 3; i++) {
    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctorProfiles[i]!.id,
        startTime: pastDate(7 - i, 10),
        endTime: pastDate(7 - i, 11),
        isBlocked: false,
      },
    });
    pastSlots.push(slot);
  }

  // ── 5. Create confirmed appointments (future) ───────────────────────────
  console.log('  + Creating confirmed appointments …');

  // Find open future slots for first 3 doctors (take 1st available slot each)
  const confirmedAppointments = [];
  for (let i = 0; i < 3; i++) {
    const doctorSlots = allSlots.filter(
      (s) => s.doctorId === doctorProfiles[i]!.id && !s.isBlocked,
    );
    const slot = doctorSlots[0]!;

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patientProfiles[i]!.id,
        doctorId: doctorProfiles[i]!.id,
        slotId: slot.id,
        status: AppointmentStatus.CONFIRMED,
        jitsiRoom: `lunasol-${doctorProfiles[i]!.id.slice(-6)}-${patientProfiles[i]!.id.slice(-6)}`,
      },
    });
    confirmedAppointments.push(appointment);
  }

  // ── 6. Create completed appointments (past) + consultation records ──────
  console.log('  + Creating completed appointments with records …');

  const consultationData = [
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
    {
      notes:
        'Patient reports facial acne flare-up over the past month, primarily on forehead and chin. No cystic lesions observed. Mild comedonal and papular acne. Skin otherwise well-hydrated. Prescribed topical retinoid and gentle cleanser routine.',
      prescriptions: [
        {
          medicationName: 'Adapalene Gel 0.1%',
          dosage: 'Pea-sized amount',
          frequency: 'Once daily at bedtime',
          duration: '60 days',
          notes: 'Apply to clean, dry skin. Use sunscreen during the day — increased photosensitivity.',
        },
        {
          medicationName: 'Benzoyl Peroxide 2.5% Wash',
          dosage: 'As directed',
          frequency: 'Once daily in the morning',
          duration: '60 days',
          notes: 'Lather on affected areas for 1–2 minutes, then rinse.',
        },
      ],
    },
  ];

  for (let i = 0; i < 3; i++) {
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patientProfiles[i]!.id,
        doctorId: doctorProfiles[i]!.id,
        slotId: pastSlots[i]!.id,
        status: AppointmentStatus.COMPLETED,
        jitsiRoom: `lunasol-past-${i + 1}`,
        record: {
          create: {
            notes: consultationData[i]!.notes,
            prescriptions: {
              create: consultationData[i]!.prescriptions,
            },
          },
        },
      },
    });
  }

  // ── 7. Create notifications ──────────────────────────────────────────────
  console.log('  + Creating notifications …');

  // Fetch all users for notification recipients
  const allUsers = await prisma.user.findMany();
  const doctorUsers = allUsers.filter((u) => u.role === Role.DOCTOR);
  const patientUsers = allUsers.filter((u) => u.role === Role.PATIENT);

  const notifications = [
    // Patient notifications
    {
      recipientId: patientUsers[0]!.id,
      type: 'APPOINTMENT_CONFIRMED',
      message: `Your appointment with ${DOCTORS[0]!.name} has been confirmed.`,
      isRead: false,
    },
    {
      recipientId: patientUsers[0]!.id,
      type: 'CONSULTATION_COMPLETE',
      message: `${DOCTORS[0]!.name} has completed your consultation. View your records and prescriptions.`,
      isRead: true,
    },
    {
      recipientId: patientUsers[0]!.id,
      type: 'PRESCRIPTION_ISSUED',
      message: 'A new prescription has been issued for you. Check your medical records.',
      isRead: true,
    },
    {
      recipientId: patientUsers[1]!.id,
      type: 'APPOINTMENT_CONFIRMED',
      message: `Your appointment with ${DOCTORS[1]!.name} has been confirmed.`,
      isRead: false,
    },
    {
      recipientId: patientUsers[1]!.id,
      type: 'APPOINTMENT_REMINDER',
      message: 'Reminder: You have an upcoming appointment tomorrow at 10:00 AM.',
      isRead: false,
    },
    {
      recipientId: patientUsers[2]!.id,
      type: 'APPOINTMENT_CONFIRMED',
      message: `Your appointment with ${DOCTORS[2]!.name} has been confirmed.`,
      isRead: true,
    },
    {
      recipientId: patientUsers[2]!.id,
      type: 'CONSULTATION_COMPLETE',
      message: `${DOCTORS[2]!.name} has completed your consultation. View your records and prescriptions.`,
      isRead: false,
    },
    {
      recipientId: patientUsers[3]!.id,
      type: 'WELCOME',
      message: 'Welcome to LunaSol! Discover doctors and book your first consultation.',
      isRead: true,
    },

    // Doctor notifications
    {
      recipientId: doctorUsers[0]!.id,
      type: 'NEW_APPOINTMENT',
      message: `New appointment booked by ${PATIENTS[0]!.name}.`,
      isRead: true,
    },
    {
      recipientId: doctorUsers[0]!.id,
      type: 'APPOINTMENT_REMINDER',
      message: 'Reminder: You have 2 appointments scheduled for tomorrow.',
      isRead: false,
    },
    {
      recipientId: doctorUsers[1]!.id,
      type: 'NEW_APPOINTMENT',
      message: `New appointment booked by ${PATIENTS[1]!.name}.`,
      isRead: false,
    },
    {
      recipientId: doctorUsers[2]!.id,
      type: 'NEW_APPOINTMENT',
      message: `New appointment booked by ${PATIENTS[2]!.name}.`,
      isRead: true,
    },
    {
      recipientId: doctorUsers[3]!.id,
      type: 'WELCOME',
      message: 'Welcome to LunaSol! Set up your availability to start accepting patients.',
      isRead: false,
    },
    {
      recipientId: doctorUsers[4]!.id,
      type: 'WELCOME',
      message: 'Welcome to LunaSol! Set up your availability to start accepting patients.',
      isRead: false,
    },
    {
      recipientId: doctorUsers[5]!.id,
      type: 'WELCOME',
      message: 'Welcome to LunaSol! Set up your availability to start accepting patients.',
      isRead: true,
    },
  ];

  await prisma.notification.createMany({ data: notifications });

  // ── Done ─────────────────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    doctorProfiles: await prisma.doctorProfile.count(),
    patientProfiles: await prisma.patientProfile.count(),
    availabilitySlots: await prisma.availabilitySlot.count(),
    appointments: await prisma.appointment.count(),
    consultationRecords: await prisma.consultationRecord.count(),
    prescriptions: await prisma.prescription.count(),
    notifications: await prisma.notification.count(),
  };

  console.log('\n✅ Seed complete!');
  console.log('   Records created:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`     ${table}: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
