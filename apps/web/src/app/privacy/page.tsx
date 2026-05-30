import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How LunaSol collects, uses, and protects your personal and health information.',
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="May 30, 2026"
      intro="This is a sample privacy policy for the LunaSol demo and is provided for illustration only — it is not legal advice. Replace it with a policy reviewed by qualified counsel before handling real patient data."
      sections={[
        {
          heading: 'Information we collect',
          body: (
            <p>
              We collect the account details you provide when you sign up (name, email, and role),
              the health information you choose to share during consultations (symptoms, notes, and
              prescriptions), and limited technical data such as device and log information needed to
              operate the service securely.
            </p>
          ),
        },
        {
          heading: 'How we use your information',
          body: (
            <p>
              Your information is used to connect you with providers, schedule and conduct
              appointments, maintain your health records, send appointment and medication reminders,
              and improve the reliability and safety of the platform. We do not sell your personal or
              health information.
            </p>
          ),
        },
        {
          heading: 'Sharing and disclosure',
          body: (
            <p>
              Health information is shared only with the licensed providers involved in your care and
              with service providers (such as video and authentication vendors) that process data on
              our behalf under appropriate safeguards. We may disclose information when required by law
              or to protect the safety of our users.
            </p>
          ),
        },
        {
          heading: 'How we protect your data',
          body: (
            <p>
              Connections are encrypted in transit, video consultations are conducted over secure
              channels, and access to records is restricted to authenticated users and their care
              team. We retain records only as long as necessary to provide care and meet legal
              obligations.
            </p>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <p>
              You may request access to, correction of, or deletion of your personal information,
              subject to medical record-retention requirements. To exercise these rights, contact us
              at <a href="mailto:support@lunasol.health" style={{ color: '#4338ca' }}>support@lunasol.health</a>.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about this policy? Email{' '}
              <a href="mailto:support@lunasol.health" style={{ color: '#4338ca' }}>support@lunasol.health</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
