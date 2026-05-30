import type { Metadata } from 'next'
import LegalPage from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of the LunaSol telehealth platform.',
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="May 30, 2026"
      intro="These are sample terms for the LunaSol demo and are provided for illustration only — they are not legal advice. Replace them with terms reviewed by qualified counsel before operating a real service."
      sections={[
        {
          heading: 'Acceptance of terms',
          body: (
            <p>
              By creating an account or using LunaSol, you agree to these Terms of Service. If you do
              not agree, please do not use the platform.
            </p>
          ),
        },
        {
          heading: 'Not for emergencies',
          body: (
            <p>
              LunaSol is not intended for medical emergencies. If you are experiencing a medical
              emergency, call your local emergency number or go to the nearest emergency room. The
              platform&apos;s informational tools do not replace professional medical diagnosis or
              treatment.
            </p>
          ),
        },
        {
          heading: 'Eligibility and accounts',
          body: (
            <p>
              You must be of legal age in your jurisdiction to create an account and are responsible
              for keeping your login credentials secure. Providers are responsible for maintaining
              valid licensure. You agree to provide accurate information and to use the platform
              lawfully.
            </p>
          ),
        },
        {
          heading: 'Use of the service',
          body: (
            <p>
              You agree not to misuse the platform, interfere with its operation, attempt to access
              data you are not authorized to view, or use it for any unlawful purpose. We may suspend
              or terminate accounts that violate these terms.
            </p>
          ),
        },
        {
          heading: 'Consultations and records',
          body: (
            <p>
              Appointments, consultation notes, and prescriptions are created by licensed providers.
              LunaSol facilitates these interactions but is not the provider of medical care. Medical
              records are retained as required by applicable law.
            </p>
          ),
        },
        {
          heading: 'Limitation of liability',
          body: (
            <p>
              The platform is provided &quot;as is&quot; without warranties of any kind. To the extent
              permitted by law, LunaSol is not liable for indirect or consequential damages arising
              from your use of the service.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about these terms? Email{' '}
              <a href="mailto:support@lunasol.health" style={{ color: '#4338ca' }}>support@lunasol.health</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
