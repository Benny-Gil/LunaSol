'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Camera } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { SPECIALIZATIONS } from '@lunasol/types'

const OTHER = '__other__'

interface DoctorProfileData {
  name: string
  specialization: string
  bio: string
  contactDetails: string
  profilePictureUrl: string | null
}

const defaultProfile: DoctorProfileData = {
  name: '',
  specialization: '',
  bio: '',
  contactDetails: '',
  profilePictureUrl: null,
}

export default function DoctorProfileForm({ mode }: { mode: 'onboarding' | 'edit' }) {
  const router = useRouter()
  const { getToken } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<DoctorProfileData>(defaultProfile)
  const [pictureFile, setPictureFile] = useState<File | null>(null)
  const [picturePreview, setPicturePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  // True when the loaded/typed specialization isn't one of the canonical options.
  const [useOther, setUseOther] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const data = await apiFetch('/doctors/me', { token: token || undefined })
        const specialization = data.specialization || ''
        setProfile({
          name: data.name || '',
          specialization,
          bio: data.bio || '',
          contactDetails: data.contactDetails || '',
          profilePictureUrl: data.profilePictureUrl || null,
        })
        setUseOther(!!specialization && !SPECIALIZATIONS.includes(specialization as never))
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
    if (!profile.specialization.trim()) e.specialization = 'Specialization is required'
    if (!profile.bio.trim()) e.bio = 'Bio is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  useEffect(() => {
    return () => {
      if (picturePreview) URL.revokeObjectURL(picturePreview)
    }
  }, [picturePreview])

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

      await apiFetch('/doctors/me', {
        token: tokenStr,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          specialization: profile.specialization,
          bio: profile.bio,
          contactDetails: profile.contactDetails || undefined,
        }),
      })

      if (pictureFile) {
        const form = new FormData()
        form.append('file', pictureFile)
        await apiFetch('/doctors/me/picture', {
          token: tokenStr,
          method: 'POST',
          body: form,
        })
      }

      router.push('/dashboard/doctor')
    } catch (err) {
      console.error('Doctor profile save failed:', err)
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
          {isOnboarding ? 'Set up your doctor profile' : 'Edit profile'}
        </h1>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
          {isOnboarding
            ? 'Complete your profile so patients can find and book you.'
            : 'Update your professional information.'}
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
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', marginBottom: 0 }}>JPG, PNG up to 5 MB</p>
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
            placeholder="Dr. Jane Doe"
          />
          {errors.name && <p style={errorStyle}>{errors.name}</p>}
        </div>

        {/* Specialization */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Specialization *</label>
          <select
            style={{ ...inputStyle, background: '#ffffff', cursor: 'pointer', borderColor: errors.specialization ? '#dc2626' : '#d1d5db' }}
            value={useOther ? OTHER : profile.specialization}
            onChange={(e) => {
              const val = e.target.value
              if (val === OTHER) {
                setUseOther(true)
                setProfile((p) => ({ ...p, specialization: '' }))
              } else {
                setUseOther(false)
                setProfile((p) => ({ ...p, specialization: val }))
              }
            }}
          >
            <option value="" disabled>Select a specialization</option>
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={OTHER}>Other…</option>
          </select>
          {useOther && (
            <input
              style={{ ...inputStyle, marginTop: '8px', borderColor: errors.specialization ? '#dc2626' : '#d1d5db' }}
              value={profile.specialization}
              onChange={(e) => setProfile((p) => ({ ...p, specialization: e.target.value }))}
              placeholder="Enter your specialization"
            />
          )}
          {errors.specialization && <p style={errorStyle}>{errors.specialization}</p>}
        </div>

        {/* Bio */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Bio *</label>
          <textarea
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', borderColor: errors.bio ? '#dc2626' : '#d1d5db' }}
            value={profile.bio}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            placeholder="Tell patients about your background, experience, and approach to care..."
          />
          {errors.bio && <p style={errorStyle}>{errors.bio}</p>}
        </div>

        {/* Contact details */}
        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>Contact details</label>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={profile.contactDetails}
            onChange={(e) => setProfile((p) => ({ ...p, contactDetails: e.target.value }))}
            placeholder="Phone, clinic address, or other contact info..."
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          {!isOnboarding && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/doctor')}
              style={{ background: '#ffffff', border: '1px solid #d1d5db', color: '#374151', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#9ca3af' : '#065f46',
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
