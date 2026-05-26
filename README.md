# LunaSol

A telehealth web application that connects patients with doctors for online consultations.

## Features

- Patient and doctor registration with role-based access
- Doctor discovery with specialization search and AI-powered recommendations
- Appointment booking, rescheduling, and cancellation
- Virtual consultation sessions
- Doctor-issued consultation notes and prescriptions
- Medical records accessible to both patients and doctors
- Real-time push notifications

## Modules

| Module  | Description                                                               |
| ------- | ------------------------------------------------------------------------- |
| Patient | Register, discover doctors, book consultations, view medical records      |
| Doctor  | Manage availability, conduct consultations, write notes and prescriptions |

## Stack

TBD

## Getting Started

TBD

## Database

### Seeding

Populate the database with sample doctors, patients, appointments, consultation records, prescriptions, and notifications:

```bash
# From the repo root
pnpm seed

# Or from apps/api
pnpm run seed
```

The seed script is **idempotent** — it wipes all existing data and re-creates it from scratch, so it is safe to run repeatedly.

### Reset & Re-seed

To drop all tables, re-run migrations, and re-seed in one command:

```bash
npx prisma migrate reset --schema apps/api/prisma/schema.prisma
```

### Seed Data Summary

| Entity              | Count | Notes                                           |
| ------------------- | ----- | ----------------------------------------------- |
| Doctors             | 7     | Varied specializations, complete profiles       |
| Patients            | 4     | Realistic name, DOB, weight, height, history    |
| Availability Slots  | ~100  | Open + blocked slots across the next 14 days    |
| Appointments        | 6     | 3 confirmed (future) + 3 completed (past)       |
| Consultation Records| 3     | Attached to completed appointments              |
| Prescriptions       | ~5    | 1–3 per consultation record                     |
| Notifications       | ~15   | Mix of read/unread for doctors and patients      |
