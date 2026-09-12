'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    WebkitBoxShadow: '0 0 0 1000px #ffffff inset',
    WebkitTextFillColor: '#16181c'
})

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#16181c',
    marginBottom: '6px',
}

export default function SignupPage() {
    const router = useRouter()
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [serverError, setServerError] = useState('')

    function validate() {
        const e: Record<string, string> = {}
        if (form.name.length < 2) e.name = 'Name must be at least 2 characters'
        if (!form.email.includes('@')) e.email = 'Enter a valid email address'
        if (form.password.length < 8) e.password = 'At least 8 characters required'
        if (!/[A-Z]/.test(form.password)) e.password = 'Include one uppercase letter'
        if (!/[0-9]/.test(form.password)) e.password = 'Include one number'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setServerError('')
        if (!validate()) return
        setLoading(true)
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) { setServerError(data.error); return }
            router.push(`/verify?userId=${data.userId}&email=${encodeURIComponent(form.email)}`)
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
                Create account
            </h1>
            <p style={{ fontSize: '14px', textAlign: 'center', color: '#6b7280', margin: '0 0 28px' }}>
                Join SafeVoice today
            </p>

            {serverError && (
                <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                    {serverError}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="name" style={labelStyle}>Full name *</label>
                    <input
                        id="name" type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="Faith Joseph"
                        autoComplete="name"
                        style={inputStyle(!!errors.name)}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = errors.name ? '#e57373' : '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                    {errors.name && <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '4px' }}>{errors.name}</p>}
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="email" style={labelStyle}>Email address *</label>
                    <input
                        id="email" type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="you@example.com"
                        autoComplete="email"
                        style={inputStyle(!!errors.email)}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = errors.email ? '#e57373' : '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                    {errors.email && <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '4px' }}>{errors.email}</p>}
                </div>

                <div style={{ marginBottom: '28px' }}>
                    <label htmlFor="password" style={labelStyle}>Password *</label>
                    <input
                        id="password" type="password"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="Min 8 chars, one uppercase, one number"
                        autoComplete="new-password"
                        style={inputStyle(!!errors.password)}
                        onFocus={e => { e.target.style.borderColor = '#0a4d2a'; e.target.style.boxShadow = '0 0 0 3px rgba(10,77,42,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = errors.password ? '#e57373' : '#d1d5db'; e.target.style.boxShadow = 'none' }}
                    />
                    {errors.password && <p style={{ fontSize: '12px', color: '#8b1a1a', marginTop: '4px' }}>{errors.password}</p>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Link href="/signin" style={{ textDecoration: 'none' }}>
                        <button type="button" style={{
                            width: '100%', padding: '10px 0', borderRadius: '8px',
                            border: '1px solid #d1d5db', backgroundColor: '#ffffff',
                            color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        }}>
                            Sign in
                        </button>
                    </Link>
                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '10px 0', borderRadius: '8px',
                        border: 'none', backgroundColor: loading ? '#5a8f6e' : '#0a4d2a',
                        color: '#ffffff', fontSize: '14px', fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                    }}>
                        {loading ? 'Creating...' : 'Sign up'}
                    </button>
                </div>
            </form>
        </div>
    )
}