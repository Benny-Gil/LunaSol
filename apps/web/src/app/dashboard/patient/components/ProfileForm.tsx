'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Camera } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ProfileData {
  name: string
  birthday: string
  weight: number
  height: number
  phone: string
  address: string
  medicalHistory: string
  profilePictureUrl: string | null
}

const defaultProfile: ProfileData = {
  name: '',
  birthday: '',
  weight: 0,
  height: 0,
  phone: '',
  address: '',
  medicalHistory: '',
  profilePictureUrl: null,
}

function formatDate(iso: string) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function ProfileForm({ mode }: { mode: 'onboarding' | 'edit' }) {
  const router = useRouter()
  const { getToken } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData>(defaultProfile)
  const [pictureFile, setPictureFile] = useState<File | null>(null)
  const [picturePreview, setPicturePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    return () => {
      if (picturePreview) URL.revokeObjectURL(picturePreview)
    }
  }, [picturePreview])

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const data = await apiFetch('/patients/me', { token: token || undefined })
        setProfile({
          name: data.name || '',
          birthday: formatDate(data.birthday),
          weight: data.weight || 0,
          height: data.height || 0,
          phone: data.phone || '',
          address: data.address || '',
          medicalHistory: data.medicalHistory || '',
          profilePictureUrl: data.profilePictureUrl || null,
        })
      } catch {
        // Profile doesn't exist yet, keep defaults
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [getToken])

  function validate(): boolean {
    const e: Record<string, string> = {}

    if (!profile.name.trim()) e.name = 'Name is required'

    if (!profile.birthday) {
      e.birthday = 'Date of birth is required'
    } else {
      const d = new Date(profile.birthday)
      const year = d.getFullYear()
      const now = new Date()
      if (isNaN(d.getTime())) {
        e.birthday = 'Enter a valid date'
      } else if (year < 1900 || year > now.getFullYear()) {
        e.birthday = `Year must be between 1900 and ${now.getFullYear()}`
      } else if (d > now) {
        e.birthday = 'Date of birth cannot be in the future'
      }
    }

    if (!profile.weight || profile.weight <= 0) e.weight = 'Enter a valid weight'
    if (!profile.height || profile.height <= 0) e.height = 'Enter a valid height'

    if (profile.phone) {
      // E.164-ish: + followed by country code (1–3 digits) and subscriber number, total 7–15 digits
      const phoneRegex = /^\+[1-9]\d{6,14}$/
      if (!phoneRegex.test(profile.phone.replace(/[\s\-().]/g, ''))) {
        e.phone = 'Include country code (e.g. +1 555 123 4567). Must be 7–15 digits total.'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (picturePreview) URL.revokeObjectURL(picturePreview)
    setPictureFile(file)
    setPicturePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const token = await getToken()
      const tokenStr = token || undefined

      await apiFetch('/patients/me', {
        token: tokenStr,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          birthday: profile.birthday,
          weight: profile.weight,
          height: profile.height,
          phone: profile.phone || undefined,
          address: profile.address || undefined,
          medicalHistory: profile.medicalHistory || undefined,
        }),
      })

      if (pictureFile) {
        const form = new FormData()
        form.append('file', pictureFile)
        await apiFetch('/patients/me/picture', {
          token: tokenStr,
          method: 'POST',
          body: form,
        })
      }

      router.push('/dashboard/patient')
    } catch (err) {
      console.error('Profile save failed:', err)
      setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading...</p>
      </div>
    )
  }

  const pictureUrl = picturePreview || profile.profilePictureUrl
  const isOnboarding = mode === 'onboarding'

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '6px',
  }

  const errorStyle: React.CSSProperties = {
    color: '#dc2626',
    fontSize: '13px',
    marginTop: '4px',
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          {isOnboarding ? 'Complete your profile' : 'Edit profile'}
        </h1>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          {isOnboarding
            ? 'Fill in your details so your care team has the information they need.'
            : 'Update your personal and medical information.'}
        </p>
      </div>

      {errors.form && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px', color: '#dc2626', fontSize: '14px' }}>
          {errors.form}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Profile picture */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: pictureUrl ? `url(${pictureUrl}) center/cover` : '#f3f4f6',
              border: '2px dashed #d1d5db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {!pictureUrl && <Camera size={24} color="#9ca3af" />}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
            >
              {pictureUrl ? 'Change photo' : 'Upload photo'}
            </button>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>JPG, PNG up to 5 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePictureChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Full name *</label>
          <input
            style={{ ...inputStyle, borderColor: errors.name ? '#dc2626' : '#d1d5db' }}
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            placeholder="Jane Doe"
          />
          {errors.name && <p style={errorStyle}>{errors.name}</p>}
        </div>

        {/* Birthday */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Date of birth *</label>
          <input
            type="date"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            style={{ ...inputStyle, borderColor: errors.birthday ? '#dc2626' : '#d1d5db' }}
            value={profile.birthday}
            onChange={(e) => setProfile((p) => ({ ...p, birthday: e.target.value }))}
          />
          {errors.birthday && <p style={errorStyle}>{errors.birthday}</p>}
        </div>

        {/* Weight & Height */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={labelStyle}>Weight (kg) *</label>
            <input
              type="number"
              step="0.1"
              style={{ ...inputStyle, borderColor: errors.weight ? '#dc2626' : '#d1d5db' }}
              value={profile.weight || ''}
              onChange={(e) => setProfile((p) => ({ ...p, weight: parseFloat(e.target.value) || 0 }))}
              placeholder="70"
            />
            {errors.weight && <p style={errorStyle}>{errors.weight}</p>}
          </div>
          <div>
            <label style={labelStyle}>Height (cm) *</label>
            <input
              type="number"
              step="0.1"
              style={{ ...inputStyle, borderColor: errors.height ? '#dc2626' : '#d1d5db' }}
              value={profile.height || ''}
              onChange={(e) => setProfile((p) => ({ ...p, height: parseFloat(e.target.value) || 0 }))}
              placeholder="170"
            />
            {errors.height && <p style={errorStyle}>{errors.height}</p>}
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            style={{ ...inputStyle, borderColor: errors.phone ? '#dc2626' : '#d1d5db' }}
            value={profile.phone}
            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+1 555 123 4567"
          />
          {errors.phone
            ? <p style={errorStyle}>{errors.phone}</p>
            : <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: 0 }}>Include country code, e.g. +1 555 123 4567</p>
          }
        </div>

        {/* Address */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Address</label>
          <textarea
            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
            value={profile.address}
            onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
            placeholder="123 Main St, City, State"
          />
        </div>

        {/* Medical history */}
        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>Medical history</label>
          <textarea
            style={{ ...inputStyle, minHeight: '96px', resize: 'vertical' }}
            value={profile.medicalHistory}
            onChange={(e) => setProfile((p) => ({ ...p, medicalHistory: e.target.value }))}
            placeholder="Allergies, chronic conditions, past surgeries..."
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {!isOnboarding && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/patient')}
              style={{ background: '#ffffff', border: '1px solid #d1d5db', color: '#374151', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#9ca3af' : '#111827',
              border: 'none',
              color: '#ffffff',
              padding: '12px 32px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Saving...' : isOnboarding ? 'Complete profile' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
