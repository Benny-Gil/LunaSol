'use client'

import { useSignUp } from '@clerk/nextjs/legacy'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'patient' | 'doctor'>('patient')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (!isLoaded) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError('')
    setLoading(true)
    try {
      await signUp.create({
        emailAddress,
        password,
        unsafeMetadata: { role },
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err) {
      const errorObject = err as any
      setError(
        errorObject.errors?.[0]?.longMessage ||
          errorObject.errors?.[0]?.message ||
          'An error occurred during sign up.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoaded) return
    setError('')
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.push('/dashboard')
      } else {
        setError('Verification failed. Please try again.')
      }
    } catch (err) {
      const errorObject = err as any
      setError(
        errorObject.errors?.[0]?.longMessage ||
          errorObject.errors?.[0]?.message ||
          'Verification failed. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Segoe UI', system-ui, sans-serif", padding: '24px' }}>
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            {pendingVerification ? 'Verify your email' : 'Create your account'}
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {pendingVerification ? `We sent a code to ${emailAddress}` : 'Join LunaSol Telehealth today'}
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 16px', color: '#b91c1c', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {!pendingVerification ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', color: '#111827', boxSizing: 'border-box' }}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', color: '#111827', boxSizing: 'border-box' }}
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="role" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                I am registering as a
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'patient' | 'doctor')}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', color: '#111827', background: '#ffffff', boxSizing: 'border-box' }}
              >
                <option value="patient">Patient (seeking healthcare services)</option>
                <option value="doctor">Doctor (providing healthcare services)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', marginTop: '8px' }}
            >
              {loading ? 'Creating...' : 'Sign Up'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="code" style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                Verification code
              </label>
              <input
                id="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', color: '#111827', boxSizing: 'border-box', letterSpacing: '4px', textAlign: 'center' }}
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: '#111827', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '28px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Already have an account?{' '}
            <a href="/sign-in" style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
              Sign In
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}
