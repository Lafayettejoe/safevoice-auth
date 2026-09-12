'use client'

import { useState } from 'react'
import Link from 'next/link'

const card: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px 36px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
    border: '1px solid #e2f0e8',
}

const Logo = () => (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: '#0a4d2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="white" />
            </svg>
        </div>
    </div>
)

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (!email.includes('@')) { setError('Enter a valid email address'); return }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            if (res.status === 429) { setError('Too many attempts. Please wait.'); return }
            setSuccess(true)
        } catch {
            setError('Something went wrong. Please try again.')
        } finally { setLoading(false) }
    }

    if (success) {
        return (
            <div style={{ ...card, textAlign: 'center' }}>
                <Logo />
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>Check your inbox</h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
                    If an account exists for <strong style={{ color: '#16181c' }}>{email}</strong>, a reset link has been sent.
                </p>
                <Link href="/signin" style={{ fontSize: '14px', color: '#1a7a44', fontWeight: 600, textDecoration: 'none' }}>
                    Back to sign in
                </Link>
            </div>
        )
    }

    return (
        <div style={card}>
            <Logo />
            <h1 style={{ fontSize: '22px', fontWeight: 700, textAlign: 'center', color: '#16181c', margin: '0 0 4px' }}>
                Forgot password?
            </h1>
            <p style={{ fontSize: '14px', textAlign: 'center', color: '#6b7280', margin: '0 0 28px' }}>
                We will send a reset link to your email
            </p>

            {error && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '24px' }}>
                    <label htmlFor="email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16181c', marginBottom: '6px' }}>
                        Email address *
                    </label>
                    <input
                        id="email" type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', color: '#16181c', backgroundColor: '#ffffff', outline: 'none', boxSizing: 'border-box', WebkitBoxShadow: '0 0 0 1000px #ffffff inset', WebkitTextFillColor: '#16181c' }}
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
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>
            </form>

            <p style={{ textAlign: 'center', margin: 0 }}>
                <Link href="/signin" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 600, textDecoration: 'none' }}>
                    Back to sign in
                </Link>
            </p>
        </div>
    )
}