'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useChat } from '@/lib/useChat'
import type { ConversationSummary, ChatMessage, ConversationCounterpart } from '@lunasol/types'
import AttachmentCard from './AttachmentCard'
import Composer from './Composer'

function useIsNarrow(maxWidth = 768) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return narrow
}

function MessagesInner() {
  const router = useRouter()
  const params = useSearchParams()
  const narrow = useIsNarrow()
  const { conversations, activeId, thread, loadingThread, openConversation, startConversation, sendMessage, closeThread } =
    useChat()

  // Resolve a deep link once: ?c=<id>, or ?doctorId / ?patientId to start a thread.
  const handledRef = useRef('')
  useEffect(() => {
    const key = params.toString()
    if (handledRef.current === key) return
    const c = params.get('c')
    const doctorId = params.get('doctorId')
    const patientId = params.get('patientId')
    if (doctorId) { handledRef.current = key; startConversation({ doctorId }) }
    else if (patientId) { handledRef.current = key; startConversation({ patientId }) }
    else if (c) { handledRef.current = key; openConversation(c) }
  }, [params, startConversation, openConversation])

  const showList = !narrow || !activeId
  const showThread = !narrow || !!activeId

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><ArrowLeft size={18} /></button>
        <span style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>Messages</span>
      </nav>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {showList && (
          <aside style={{ width: narrow ? '100%' : '340px', borderRight: narrow ? 'none' : '1px solid #e5e7eb', background: '#ffffff', overflowY: 'auto', flexShrink: 0 }}>
            {conversations.length === 0 ? (
              <EmptyState />
            ) : (
              conversations.map((c) => (
                <ConversationRow key={c.id} convo={c} active={c.id === activeId} onClick={() => openConversation(c.id)} />
              ))
            )}
          </aside>
        )}

        {showThread && (
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {!thread ? (
              <Placeholder loading={loadingThread} />
            ) : (
              <Thread
                counterpart={thread.counterpart}
                messages={thread.messages}
                narrow={narrow}
                onBack={closeThread}
                onSend={sendMessage}
              />
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function Thread({
  counterpart,
  messages,
  narrow,
  onBack,
  onSend,
}: {
  counterpart: ConversationCounterpart
  messages: ChatMessage[]
  narrow: boolean
  onBack: () => void
  onSend: ReturnType<typeof useChat>['sendMessage']
}) {
  const viewerRole: 'patient' | 'doctor' = counterpart.role === 'doctor' ? 'patient' : 'doctor'
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0 }}>
        {narrow && (
          <button onClick={onBack} aria-label="Back to conversations" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><ArrowLeft size={18} /></button>
        )}
        <Avatar name={counterpart.name} url={counterpart.profilePictureUrl} />
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>{counterpart.name}</p>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, textTransform: 'capitalize' }}>
            {counterpart.role === 'doctor' ? counterpart.specialization || 'Doctor' : 'Patient'}
          </p>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9fafb' }}>
        {messages.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginTop: '24px' }}>No messages yet. Say hello, or share a record.</p>}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} mine={m.senderRole !== counterpart.role} viewerRole={viewerRole} />
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer viewerRole={viewerRole} counterpart={counterpart} onSend={onSend} />
    </>
  )
}

function Bubble({ message, mine, viewerRole }: { message: ChatMessage; mine: boolean; viewerRole: 'patient' | 'doctor' }) {
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', alignSelf: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {message.attachmentType && message.attachment && (
          <AttachmentCard type={message.attachmentType} data={message.attachment} viewerRole={viewerRole} />
        )}
        {message.body && (
          <div style={{ padding: '9px 13px', borderRadius: '16px', background: mine ? '#10b981' : '#ffffff', color: mine ? '#ffffff' : '#111827', border: mine ? 'none' : '1px solid #e5e7eb', fontSize: '14px', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.body}
          </div>
        )}
      </div>
      <span style={{ fontSize: '11px', color: '#6b7280', margin: '3px 4px 0' }}>{time}</span>
    </div>
  )
}

function ConversationRow({ convo, active, onClick }: { convo: ConversationSummary; active: boolean; onClick: () => void }) {
  const preview = convo.lastMessage
    ? convo.lastMessage.body || (convo.lastMessage.attachmentType ? `📎 ${labelFor(convo.lastMessage.attachmentType)}` : '')
    : 'No messages yet'
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: active ? '#f0fdf4' : 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', textAlign: 'left' }}
    >
      <Avatar name={convo.counterpart.name} url={convo.counterpart.profilePictureUrl} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convo.counterpart.name}</span>
          <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>{new Date(convo.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
          {convo.unreadCount > 0 && (
            <span style={{ flexShrink: 0, minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{convo.unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', padding: '40px 20px', textAlign: 'center', gap: '10px' }}>
      <MessageSquare size={28} />
      <p style={{ fontSize: '14px', margin: 0 }}>No conversations yet.</p>
    </div>
  )
}

function Placeholder({ loading }: { loading: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: '14px' }}>
      {loading ? 'Loading conversation…' : 'Select a conversation'}
    </div>
  )
}

function labelFor(type: string) {
  return { PRESCRIPTION: 'Prescription', NOTE: 'Note', APPOINTMENT: 'Appointment', AI_SUGGESTION: 'AI suggestion', SYMPTOM: 'Symptom' }[type] || 'Attachment'
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesInner />
    </Suspense>
  )
}
