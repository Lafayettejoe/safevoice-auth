'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const card: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px 36px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
    border: '1px solid #e2f0e8',
}

function VerifyForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const userId = searchParams.get('userId') || ''
    const email = searchParams.get('email') || ''
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [resendLoading, setResendLoading] = useState(false)
    const [resendMessage, setResendMessage] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (code.length !== 6) { setError('Please enter the 6-digit code'); return }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, userId }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error); return }
            router.push('/signin?verified=true')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally { setLoading(false) }
    }

    async function handleResend() {
        setResendMessage('')
        setError('')
        setResendLoading(true)
        try {
            const res = await fetch('/api/auth/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            const data = await res.json()
            if (res.status === 429) { setError('Too many attempts. Please wait.'); return }
            setResendMessage(data.message)
        } catch {
            setError('Something went wrong.')
        } finally { setResendLoading(false) }
    }

    return (
        <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    backgroundColor: '#0a4d2a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="white" />
                    </svg>
                </div>
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 700, textAlign: 'center', color: '#16181c', margin: '0 0 4px' }}>
                Check your email
            </h1>
            <p style={{ fontSize: '14px', textAlign: 'center', color: '#6b7280', margin: '0 0 28px' }}>
                We sent a 6-digit code to <strong style={{ color: '#16181c' }}>{email}</strong>
            </p>

            {error && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                    {error}
                </div>
            )}
            {resendMessage && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#e6f5ed', color: '#0a4d2a', fontSize: '13px' }}>
                    {resendMessage}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '24px' }}>
                    <label htmlFor="code" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16181c', marginBottom: '6px' }}>
                        Verification code *
                    </label>
                    <input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        autoComplete="one-time-code"
                        style={{
                            width: '100%', padding: '14px', borderRadius: '8px',
                            border: '1px solid #d1d5db', fontSize: '28px', fontWeight: 700,
                            textAlign: 'center', letterSpacing: '0.5em', color: '#16181c',
                            outline: 'none', boxSizing: 'border-box', backgroundColor: '#ffffff',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                </div>

                <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '11px 0', borderRadius: '8px',
                    border: 'none', backgroundColor: loading ? '#5a8f6e' : '#0a4d2a',
                    color: '#ffffff', fontSize: '14px', fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '20px',
                }}>
                    {loading ? 'Verifying...' : 'Verify email'}
                </button>
            </form>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: 0 }}>
                Did not receive the code?{' '}
                <button onClick={handleResend} disabled={resendLoading} style={{
                    background: 'none', border: 'none', color: '#1a7a44',
                    fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: '13px',
                }}>
                    {resendLoading ? 'Sending...' : 'Resend code'}
                </button>
            </p>
        </div>
    )
}

export default function VerifyPage() {
    return <Suspense fallback={<div>Loading...</div>}><VerifyForm /></Suspense>
}