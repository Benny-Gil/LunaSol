import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb', padding: '24px' }}>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
      />
    </main>
  )
}
