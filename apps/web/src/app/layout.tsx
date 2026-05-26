import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LunaSol Telehealth',
  description: 'Telehealth and AI assistant platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
