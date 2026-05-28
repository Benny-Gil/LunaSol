'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Filter, User } from 'lucide-react'

interface Doctor {
  id: string
  name: string
  specialization: string
  bio: string | null
  profilePictureUrl: string | null
  contactDetails: string | null
}

const SPECIALIZATIONS = [
  'All',
  'Cardiology',
  'Dermatology',
  'Family Medicine',
  'General Medicine',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
]

export default function DoctorsPage() {
  const router = useRouter()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialization, setSpecialization] = useState('All')
  const [availableOnly, setAvailableOnly] = useState(false)

  const fetchDoctors = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (specialization !== 'All') params.set('specialization', specialization)
    if (availableOnly) params.set('available', 'true')

    try {
      const res = await fetch(`/api/doctors?${params}`)
      if (res.ok) setDoctors(await res.json())
    } finally {
      setLoading(false)
    }
  }, [search, specialization, availableOnly])

  useEffect(() => {
    const t = setTimeout(fetchDoctors, 300)
    return () => clearTimeout(t)
  }, [fetchDoctors])

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <a href="/" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', textDecoration: 'none', letterSpacing: '-0.5px' }}>LunaSol</a>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/sign-in" style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#374151', textDecoration: 'none' }}>Sign In</a>
          <a href="/sign-up" style={{ padding: '8px 16px', background: '#111827', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#ffffff', textDecoration: 'none' }}>Sign Up</a>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Find a Doctor</h1>
          <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>Browse our network of licensed healthcare professionals.</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialization..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Filter size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              style={{ padding: '10px 12px 10px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#ffffff', cursor: 'pointer', minWidth: '180px' }}
            >
              {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151', background: availableOnly ? '#f0fdf4' : '#ffffff', borderColor: availableOnly ? '#86efac' : '#d1d5db' }}>
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} style={{ accentColor: '#10b981' }} />
            Available now
          </label>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <User size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>No doctors found matching your search.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {doctors.map((doctor) => (
              <div
                key={doctor.id}
                onClick={() => router.push(`/doctors/${doctor.id}`)}
                style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                    background: doctor.profilePictureUrl ? `url(${doctor.profilePictureUrl}) center/cover` : '#f3f4f6',
                    border: '2px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!doctor.profilePictureUrl && <User size={20} color="#9ca3af" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#111827' }}>{doctor.name}</h3>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '2px 8px', borderRadius: '12px' }}>
                      {doctor.specialization}
                    </span>
                  </div>
                </div>
                {doctor.bio && (
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {doctor.bio}
                  </p>
                )}
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>View profile →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
