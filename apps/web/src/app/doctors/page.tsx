'use client'

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Show, UserButton } from '@clerk/nextjs'
import { Search, Filter, User, Sparkles, AlertTriangle, Send, RefreshCw, X, ArrowRight, ShieldCheck, HeartPulse, Info } from 'lucide-react'
import { useAiRecommendation, ChatMessage } from '../../lib/useAiRecommendation'
import { SPECIALIZATIONS as SPECIALIZATION_OPTIONS } from '@lunasol/types'

interface Doctor {
  id: string
  name: string
  specialization: string
  bio: string | null
  profilePictureUrl: string | null
  contactDetails: string | null
}

// 'All' is a filter-only option; the rest come from the shared canonical list.
const SPECIALIZATIONS = ['All', ...SPECIALIZATION_OPTIONS]

const QUICK_SYMPTOMS = [
  { label: 'Severe headache', text: 'I have a severe, throbbing headache on the right side of my head with some light sensitivity and nausea.' },
  { label: 'Skin rash', text: 'There is a red, itchy rash spreading across my arm, and it feels slightly warm to the touch.' },
  { label: 'Chest pressure', text: 'I am feeling a tight pressure in my chest, and it feels like it is radiating up to my neck.' },
  { label: 'Persistent cough', text: 'I have had a dry, persistent cough for over two weeks, and it gets worse at night with slight wheezing.' },
  { label: 'Stomach pain', text: 'I have had cramping pain in my upper abdomen for a few days, with bloating, heartburn, and occasional nausea after eating.' },
  { label: 'Joint pain', text: 'My knees and fingers have been swollen, stiff, and achy for several weeks, and the stiffness is worst in the morning.' },
  { label: 'Anxiety & low mood', text: 'I have been feeling persistently anxious and low for the past month, with trouble sleeping and difficulty concentrating.' },
  { label: 'Always thirsty & tired', text: 'I am constantly thirsty, urinating often, losing weight, and feeling very fatigued over the last few weeks.' },
  { label: 'Shortness of breath', text: 'I get short of breath and wheezy after light activity, with a tight chest and a cough that brings up phlegm.' },
  { label: 'Ear pain', text: 'My right ear has been painful and feels blocked for several days, with reduced hearing and some ringing.' },
  { label: 'Blurry vision', text: 'My vision has become blurry over the past week, with some eye strain, redness, and sensitivity to light.' },
  { label: 'Painful urination', text: 'It burns when I urinate and I feel the urge to go very frequently, with some lower abdominal discomfort.' },
]

const formatAiResponse = (content: string, isUser: boolean = false) => {
  if (!content) return null

  // Helper to parse bold markdown **text**
  const parseInline = (text: string) => {
    if (!text) return ''
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong 
            key={i} 
            style={{ 
              fontWeight: 700, 
              color: isUser ? '#ffffff' : '#0f172a',
              background: isUser ? 'none' : 'rgba(99, 102, 241, 0.08)',
              padding: isUser ? '0' : '1px 4px',
              borderRadius: '4px'
            }}
          >
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let inList = false

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul 
          key={`list-${key}`} 
          style={{ 
            margin: '8px 0 12px', 
            paddingLeft: '20px', 
            listStyleType: 'none', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}
        >
          {listItems}
        </ul>
      )
      listItems = []
      inList = false
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ')
    const isHeading3 = trimmed.startsWith('### ')
    const isHeading2 = trimmed.startsWith('## ')

    if (isBullet) {
      if (!inList) {
        inList = true
      }
      const itemContent = trimmed.substring(2)
      listItems.push(
        <li 
          key={`li-${index}`} 
          style={{ 
            position: 'relative', 
            paddingLeft: '16px',
            fontSize: '14px',
            lineHeight: '1.6',
            color: isUser ? '#ffffff' : '#334155'
          }}
        >
          <span style={{
            position: 'absolute',
            left: 0,
            top: '9px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isUser ? '#ffffff' : '#6366f1'
          }} />
          {parseInline(itemContent)}
        </li>
      )
    } else if (isHeading3) {
      if (inList) flushList(index)
      const headerContent = trimmed.substring(4)
      elements.push(
        <h4 
          key={`h3-${index}`} 
          style={{ 
            fontSize: '15px', 
            fontWeight: 700, 
            margin: '16px 0 8px', 
            color: isUser ? '#ffffff' : '#0f172a' 
          }}
        >
          {parseInline(headerContent)}
        </h4>
      )
    } else if (isHeading2) {
      if (inList) flushList(index)
      const headerContent = trimmed.substring(3)
      elements.push(
        <h3 
          key={`h2-${index}`} 
          style={{ 
            fontSize: '16px', 
            fontWeight: 800, 
            margin: '18px 0 10px', 
            color: isUser ? '#ffffff' : '#0f172a' 
          }}
        >
          {parseInline(headerContent)}
        </h3>
      )
    } else {
      if (inList) {
        flushList(index)
      }
      if (trimmed) {
        elements.push(
          <p 
            key={`p-${index}`} 
            style={{ 
              margin: '6px 0 10px', 
              fontSize: '14px', 
              lineHeight: '1.6',
              color: isUser ? '#ffffff' : '#334155'
            }}
          >
            {parseInline(line)}
          </p>
        )
      } else {
        elements.push(<div key={`space-${index}`} style={{ height: '8px' }} />)
      }
    }
  })

  if (inList) {
    flushList(lines.length)
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>
}

// Compact, accessible disclaimer indicator. Reveals the full safety/legal text
// on hover and on keyboard focus. The text stays in the DOM (role="tooltip")
// and is associated with the trigger via aria-describedby for screen readers.
function DisclaimerTooltip() {
  const [open, setOpen] = useState(false)
  const tooltipId = 'ai-matcher-disclaimer'

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          background: 'rgba(254, 243, 199, 0.55)',
          color: '#92400e',
          fontSize: '12.5px',
          fontWeight: 600,
          cursor: 'help',
        }}
      >
        <ShieldCheck size={14} color="#d97706" style={{ flexShrink: 0 }} />
        <span>Informational only</span>
        <Info size={13} color="#d97706" style={{ flexShrink: 0 }} />
      </button>

      <div
        id={tooltipId}
        role="tooltip"
        style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          zIndex: 20,
          width: '320px',
          maxWidth: '80vw',
          background: 'rgba(254, 243, 199, 0.97)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '14px 16px',
          color: '#92400e',
          fontSize: '13px',
          lineHeight: '1.5',
          boxShadow: '0 12px 28px -10px rgba(146, 64, 14, 0.25)',
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          transform: open ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          pointerEvents: open ? 'auto' : 'none',
          textAlign: 'left',
          fontWeight: 400,
        }}
      >
        <strong style={{ fontWeight: 700, display: 'block', marginBottom: '4px', fontSize: '13.5px' }}>AI Triage Advisor (Informational Only)</strong>
        This tool utilizes clinical-grade language models to map described symptoms to specialties within our network. It <strong>does not diagnose illnesses, prescribe medications, or replace professional medical advice</strong>. If you are experiencing a severe, sudden, or life-threatening situation, please call emergency responders (e.g. 911) immediately.
      </div>
    </div>
  )
}

export default function DoctorsPage() {
  const router = useRouter()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialization, setSpecialization] = useState('All')
  const [availableOnly, setAvailableOnly] = useState(false)

  // AI Recommendation Hook
  const [symptomsQuery, setSymptomsQuery] = useState('')
  const [followUpQuery, setFollowUpQuery] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const {
    streamChat,
    messages,
    reasoning,
    recommendedDoctors,
    loading: aiLoading,
    error: aiError,
    reset: resetAi,
  } = useAiRecommendation()

  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, reasoning, scrollToBottom])

  const fetchDoctors = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (specialization !== 'All') params.set('specialization', specialization)
    if (availableOnly) params.set('available', 'true')

    try {
      const res = await fetch(`/api/doctors?${params}`)
      if (res.ok) setDoctors(await res.json())
    } catch (err) {
      console.error('Failed to fetch doctors list:', err)
    } finally {
      setLoading(false)
    }
  }, [search, specialization, availableOnly])

  useEffect(() => {
    const t = setTimeout(fetchDoctors, 300)
    return () => clearTimeout(t)
  }, [fetchDoctors])

  const handleAiSubmit = (e: FormEvent) => {
    e.preventDefault()
    const queryText = symptomsQuery.trim()
    if (!queryText || queryText.length < 10) return
    streamChat([{ role: 'user', content: queryText }])
    setSymptomsQuery('')
  }

  const handleFollowUpSubmit = (e: FormEvent) => {
    e.preventDefault()
    const queryText = followUpQuery.trim()
    if (!queryText || aiLoading) return
    const nextHistory: ChatMessage[] = [
      ...messages.filter(m => m.content !== '' || m.role !== 'assistant'),
      { role: 'user', content: queryText }
    ]
    streamChat(nextHistory)
    setFollowUpQuery('')
  }

  const handleQuickSymptomClick = (text: string) => {
    setSymptomsQuery(text)
  }


  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f8fafc', minHeight: '100vh', color: '#0f172a' }}>
      
      {/* Dynamic Keyframes Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .typing-cursor {
          display: inline-block;
          width: 8px;
          height: 16px;
          background-color: #6366f1;
          margin-left: 4px;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
        }
        .carousel-container::-webkit-scrollbar {
          height: 8px;
        }
        .carousel-container::-webkit-scrollbar-track {
          background: rgba(229, 231, 235, 0.3);
          border-radius: 9999px;
        }
        .carousel-container::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 9999px;
        }
        .carousel-container::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.8);
        }
      `}} />

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', fontWeight: 800, color: '#0f172a', textDecoration: 'none', letterSpacing: '-0.5px' }}>
          <HeartPulse size={24} color="#6366f1" />
          <span>LunaSol</span>
        </a>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Show when="signed-out">
            <a href="/sign-in" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', textDecoration: 'none', transition: 'background-color 0.2s' }}>Sign In</a>
            <a href="/sign-up" style={{ padding: '8px 16px', background: '#0f172a', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#ffffff', textDecoration: 'none', transition: 'background-color 0.2s' }}>Sign Up</a>
          </Show>
          <Show when="signed-in">
            <a href="/dashboard" style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 600, color: '#0f172a', textDecoration: 'none' }}>Dashboard</a>
            <UserButton />
          </Show>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Premium AI Doctor Matcher Section */}
        <section style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          boxShadow: '0 20px 40px -15px rgba(99, 102, 241, 0.08), 0 0 0 1px rgba(99, 102, 241, 0.03)',
          borderRadius: '24px',
          padding: '32px',
          marginBottom: '48px',
          transition: 'all 0.3s ease'
        }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={20} color="#6366f1" style={{ filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.4))' }} />
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Find the right specialist</h2>
                <DisclaimerTooltip />
              </div>
              <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>Describe your symptoms and we&apos;ll suggest the right specialties.</p>
            </div>
            
            {(messages.length > 0 || reasoning || recommendedDoctors.length > 0 || aiLoading) && (
              <button 
                onClick={resetAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}
              >
                <X size={14} />
                <span>Clear Analysis</span>
              </button>
            )}
          </div>

          {/* 2. Symptom Input Area & Conversational Flow.
                When the AI service is unavailable, hide both the form and the
                chat and point users to the directory below as a fallback. */}
          {aiError ? (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px 20px',
              color: '#475569',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <Info size={18} color="#94a3b8" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Smart matching is temporarily unavailable — browse the directory below.</span>
            </div>
          ) : messages.length === 0 ? (
            <form onSubmit={handleAiSubmit}>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <textarea
                  value={symptomsQuery}
                  onChange={(e) => setSymptomsQuery(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Describe what symptoms you are experiencing in detail..."
                  style={{
                    width: '100%',
                    minHeight: '110px',
                    padding: '16px 20px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '16px',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    transition: 'all 0.3s ease',
                    boxShadow: inputFocused 
                      ? '0 0 0 4px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(99, 102, 241, 0.04)' 
                      : 'inset 0 1px 2px rgba(0,0,0,0.02)',
                    borderColor: inputFocused ? '#6366f1' : '#cbd5e1'
                  }}
                />
              </div>

              {/* Quick Symptom Tags */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Try clicking a sample:</span>
                {QUICK_SYMPTOMS.map((tag) => (
                  <button
                    key={tag.label}
                    type="button"
                    onClick={() => handleQuickSymptomClick(tag.text)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = '#f5f3ff' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#ffffff' }}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>

              {/* Action Row */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={aiLoading || symptomsQuery.trim().length < 10}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: symptomsQuery.trim().length < 10 
                      ? '#cbd5e1' 
                      : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: symptomsQuery.trim().length < 10 
                      ? 'none' 
                      : '0 4px 14px 0 rgba(99, 102, 241, 0.35)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: symptomsQuery.trim().length < 10 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    transform: 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (symptomsQuery.trim().length >= 10 && !aiLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(99, 102, 241, 0.45)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = symptomsQuery.trim().length < 10 
                      ? 'none' 
                      : '0 4px 14px 0 rgba(99, 102, 241, 0.35)'
                  }}
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Find a specialist</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Scrollable chat messages log */}
              <div 
                ref={chatContainerRef}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: '#fafbfd',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '24px',
                  maxHeight: '450px',
                  overflowY: 'auto',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.01)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aiLoading ? '#22c55e' : '#64748b', animation: aiLoading ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {aiLoading ? 'Matching in progress' : 'Symptom assistant'}
                  </span>
                </div>

                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user'
                  const isPending = msg.role === 'assistant' && msg.content === '' && aiLoading

                  // Detect if there is a severe emergency notice in the text of this specific message
                  const bubbleIsEmergency = !isUser && (
                    msg.content.toLowerCase().includes('emergency notice') || 
                    msg.content.toLowerCase().includes('life-threatening') ||
                    msg.content.toLowerCase().includes('call 911')
                  )

                  return (
                    <div 
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-start',
                        gap: '12px',
                        width: '100%'
                      }}
                    >
                      {!isUser && (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)'
                        }}>
                          <Sparkles size={15} />
                        </div>
                      )}
                      
                      <div style={{
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#64748b',
                          alignSelf: isUser ? 'flex-end' : 'flex-start'
                        }}>
                          {isUser ? 'You' : 'Symptom assistant'}
                        </span>

                        {bubbleIsEmergency && (
                          <div style={{
                            background: 'rgba(254, 226, 226, 0.95)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: '#991b1b',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '13px', lineHeight: '1.45' }}>
                              <strong style={{ fontWeight: 700, display: 'block', marginBottom: '2px' }}>🚨 CRITICAL SAFETY ALERT</strong>
                              Your symptom description indicates a potential high-risk condition. Please bypass online triage and call emergency dispatchers immediately, or head directly to the closest urgent care clinic or emergency facility.
                            </div>
                          </div>
                        )}

                        <div style={{
                          padding: '12px 16px',
                          borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          background: isUser ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#ffffff',
                          color: isUser ? '#ffffff' : '#334155',
                          border: isUser ? 'none' : '1px solid #e2e8f0',
                          fontSize: '14.5px',
                          lineHeight: '1.6',
                          whiteSpace: isUser ? 'pre-wrap' : 'normal',
                          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)',
                          fontWeight: 500
                        }}>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                              <span style={{ fontSize: '13px', color: '#64748b' }}>Thinking...</span>
                            </div>
                          ) : (
                            formatAiResponse(msg.content, isUser)
                          )}
                          {!isUser && aiLoading && index === messages.length - 1 && <span className="typing-cursor" />}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Chat Input Bar for follow-up */}
              <form onSubmit={handleFollowUpSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  placeholder="Reply or provide more details..."
                  disabled={aiLoading}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '14px',
                    fontSize: '14.5px',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s',
                    borderColor: aiLoading ? '#e2e8f0' : '#cbd5e1'
                  }}
                />
                <button
                  type="submit"
                  disabled={aiLoading || !followUpQuery.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 24px',
                    borderRadius: '14px',
                    border: 'none',
                    background: (!followUpQuery.trim() || aiLoading) 
                      ? '#cbd5e1' 
                      : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    boxShadow: (!followUpQuery.trim() || aiLoading) 
                      ? 'none' 
                      : '0 4px 12px rgba(99, 102, 241, 0.25)',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: (!followUpQuery.trim() || aiLoading) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {aiLoading ? (
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* 4. AI Recommended Doctors List (Horizontal Carousel) */}
          {recommendedDoctors.length > 0 && (
            <div style={{ marginTop: '36px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} color="#8b5cf6" />
                <span>Suggested specialists ({recommendedDoctors.length})</span>
                {aiError && <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>({aiError})</span>}
              </h3>
              
              <div 
                className="carousel-container"
                style={{
                  display: 'flex',
                  gap: '20px',
                  overflowX: 'auto',
                  paddingBottom: '20px',
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'smooth'
                }}
              >
                {recommendedDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => router.push(`/doctors/${doc.id}`)}
                    style={{
                      flex: '0 0 350px',
                      scrollSnapAlign: 'start',
                      background: '#ffffff',
                      border: '1px solid rgba(99, 102, 241, 0.15)',
                      borderRadius: '16px',
                      padding: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 16px -6px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#8b5cf6'
                      e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(99, 102, 241, 0.12)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)'
                      e.currentTarget.style.boxShadow = '0 8px 16px -6px rgba(0,0,0,0.02)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div>
                      {/* Doctor header */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{
                          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                          background: doc.profilePictureUrl ? `url(${doc.profilePictureUrl}) center/cover` : '#f1f5f9',
                          border: '2px solid #e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {!doc.profilePictureUrl && <User size={18} color="#94a3b8" />}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 3px', color: '#0f172a' }}>{doc.name}</h4>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: '12px' }}>
                            {doc.specialization}
                          </span>
                        </div>
                      </div>

                      {/* Doctor Bio (Truncated) */}
                      {doc.bio && (
                        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {doc.bio}
                        </p>
                      )}

                      {/* Match Explanation (AI match reason) */}
                      <div style={{
                        background: '#faf5ff',
                        borderLeft: '3px solid #a78bfa',
                        padding: '12px',
                        borderRadius: '0 8px 8px 0',
                        fontSize: '12.5px',
                        color: '#5b21b6',
                        lineHeight: '1.45',
                        marginBottom: '16px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, marginBottom: '4px', fontSize: '12px' }}>
                          <Sparkles size={12} color="#7c3aed" />
                          <span>WHY THIS MATCH</span>
                        </div>
                        {doc.reason}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        <span>Consult Doctor</span>
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>

        {/* Traditional Search & Filters (Existing Header, renamed slightly for context) */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Browse Medical Directory</h1>
            <p style={{ fontSize: '15px', color: '#475569', margin: 0 }}>Browse our full network of licensed healthcare professionals manually.</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialization..."
              style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: '#ffffff', color: '#0f172a' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Filter size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              style={{ padding: '10px 12px 10px 36px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', background: '#ffffff', color: '#0f172a', cursor: 'pointer', minWidth: '180px' }}
            >
              {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#334155', background: availableOnly ? '#f0fdf4' : '#ffffff', borderColor: availableOnly ? '#86efac' : '#cbd5e1' }}>
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} style={{ accentColor: '#10b981' }} />
            Available now
          </label>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <User size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: '16px' }}>No doctors found matching your search.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {doctors.map((doctor) => (
              <div
                key={doctor.id}
                onClick={() => router.push(`/doctors/${doctor.id}`)}
                style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 20px -8px rgba(0,0,0,0.06)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
                    background: doctor.profilePictureUrl ? `url(${doctor.profilePictureUrl}) center/cover` : '#f1f5f9',
                    border: '2px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!doctor.profilePictureUrl && <User size={20} color="#94a3b8" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{doctor.name}</h3>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '2px 8px', borderRadius: '12px' }}>
                      {doctor.specialization}
                    </span>
                  </div>
                </div>
                {doctor.bio && (
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {doctor.bio}
                  </p>
                )}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>View profile →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

