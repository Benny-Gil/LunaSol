'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/useNotifications'

export default function NotificationBell() {
  const router = useRouter()
  const { user } = useUser()
  const role = (user?.publicMetadata?.role as string) || 'patient'
  const { notifications, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleClick(id: string, type: string) {
    await markRead(id)
    setOpen(false)
    // A follow-up suggestion (issue #82) deep-links the patient into the
    // booking flow so they can rebook right away.
    if (type === 'APPOINTMENT_FOLLOWUP_SUGGESTED') {
      router.push('/doctors')
    } else if (type.startsWith('APPOINTMENT')) {
      router.push(
        role === 'doctor'
          ? '/dashboard/doctor'
          : '/dashboard/patient/appointments',
      )
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          color: '#374151',
        }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '9999px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '320px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  fontWeight: 600,
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p
                style={{
                  color: '#6b7280',
                  fontSize: '13px',
                  textAlign: 'center',
                  padding: '32px 16px',
                  margin: 0,
                }}
              >
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.type)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: n.isRead ? '#fff' : '#f0f9ff',
                    border: 'none',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                  }}
                >
                  {!n.isRead && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        background: '#3b82f6',
                        borderRadius: '50%',
                        alignSelf: 'flex-end',
                      }}
                    />
                  )}
                  <span style={{ fontSize: '13px', color: '#111827', lineHeight: 1.4 }}>
                    {n.message}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{timeAgo(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
