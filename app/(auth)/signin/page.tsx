'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const card: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '40px 36px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
    border: '1px solid #e2f0e8',
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${hasError ? '#e57373' : '#d1d5db'}`,
    fontSize: '14px',
    color: '#16181c',
    backgroundColor: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    WebkitBoxShadow: '0 0 0 1000px #ffffff inset',
    WebkitTextFillColor: '#16181c',
})

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#16181c',
    marginBottom: '6px',
}

function SigninForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const verified = searchParams.get('verified')
    const [form, setForm] = useState({ email: '', password: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [serverError, setServerError] = useState('')
    const [unverifiedUserId, setUnverifiedUserId] = useState('')

    function validate() {
        const e: Record<string, string> = {}
        if (!form.email.includes('@')) e.email = 'Enter a valid email address'
        if (!form.password) e.password = 'Password is required'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setServerError('')
        setUnverifiedUserId('')
        if (!validate()) return
        setLoading(true)
        try {
            const res = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) {
                setServerError(data.error)
                if (data.userId) setUnverifiedUserId(data.userId)
                return
            }
            window.location.href = '/dashboard'
        } catch {
            setServerError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={card}>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    backgroundColor: '#0a4d2a', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="white" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="white" />
                    </svg>
                </div>
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 700, textAlign: 'center', color: '#16181c', margin: '0 0 4px' }}>
                Login
            </h1>
            <p style={{ fontSize: '14px', textAlign: 'center', color: '#6b7280', margin: '0 0 28px' }}>
                Sign in to your SafeVoice account
            </p>

            {verified && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#e6f5ed', color: '#0a4d2a', fontSize: '13px' }}>
                    Email verified. You can now sign in.
                </div>
            )}

            {serverError && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                    {serverError}
                    {unverifiedUserId && (
                        <Link href={`/verify?userId=${unverifiedUserId}&email=${encodeURIComponent(form.email)}`}
                            style={{ display: 'block', marginTop: '4px', textDecoration: 'underline', fontWeight: 600 }}>
                            Verify your email
                        </Link>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="email" style={labelStyle}>Your email *</label>
                    <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="email@yourcompany.com"
                        autoComplete="email"
                        style={inputStyle(!!errors.email)}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = errors.email ? '#e57373' : '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                    {errors.email && <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '4px' }}>{errors.email}</p>}
                </div>

                <div style={{ marginBottom: '8px' }}>
                    <label htmlFor="password" style={labelStyle}>Password *</label>
                    <input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="••••••••••••••"
                        autoComplete="current-password"
                        style={inputStyle(!!errors.password)}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = errors.password ? '#e57373' : '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                    {errors.password && <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '4px' }}>{errors.password}</p>}
                </div>

                <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                    <Link href="/forgot-password" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, textDecoration: 'none' }}>
                        Forgot your password?
                    </Link>
                </div>

                {/* Side-by-side buttons like the reference */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Link href="/signup" style={{ textDecoration: 'none' }}>
                        <button
                            type="button"
                            style={{
                                width: '100%', padding: '10px 0', borderRadius: '8px',
                                border: '1px solid #d1d5db', backgroundColor: '#ffffff',
                                color: '#374151', fontSize: '14px', fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Sign up
                        </button>
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '10px 0', borderRadius: '8px',
                            border: 'none', backgroundColor: loading ? '#5a8f6e' : '#0a4d2a',
                            color: '#ffffff', fontSize: '14px', fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Signing in...' : 'Log in'}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default function SigninPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SigninForm />
        </Suspense>
    )
}