'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token') || ''

    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    function validate() {
        if (password.length < 8) return 'At least 8 characters'
        if (!/[A-Z]/.test(password)) return 'Include one uppercase letter'
        if (!/[0-9]/.test(password)) return 'Include one number'
        return ''
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        const err = validate()
        if (err) { setError(err); return }
        setLoading(true)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error); return }
            setSuccess(true)
            setTimeout(() => router.push('/signin'), 3000)
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <div className="bg-white rounded-2xl p-8 w-full text-center"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e6f5ed' }}>
                <p className="text-sm mb-3" style={{ color: '#8b1a1a' }}>Invalid reset link.</p>
                <Link href="/forgot-password" className="text-sm font-medium" style={{ color: '#1a7a44' }}>
                    Request a new link
                </Link>
            </div>
        )
    }

    if (success) {
        return (
            <div className="bg-white rounded-2xl p-8 w-full text-center"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e6f5ed' }}>
                <div className="text-3xl mb-3">✅</div>
                <h1 className="text-xl font-bold mb-2" style={{ color: '#16181c' }}>Password reset</h1>
                <p className="text-sm" style={{ color: '#5a6270' }}>Redirecting you to sign in...</p>
            </div>
        )
    }

    return (
        <>
            <div className="bg-white rounded-2xl p-8 w-full"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(10,77,42,0.06)', border: '1px solid #e6f5ed' }}>
                <div className="flex justify-center mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0a4d2a' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="white" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-xl font-bold text-center mb-1" style={{ color: '#16181c' }}>Set new password</h1>
                <p className="text-center text-sm mb-6" style={{ color: '#5a6270' }}>Must be at least 8 characters</p>

                {error && (
                    <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>{error}</div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: '#16181c' }}>
                            New password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Min 8 chars, uppercase, number"
                            autoComplete="new-password"
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{ border: '1px solid #d1d5db', outline: 'none' }}
                            onFocus={e => e.target.style.borderColor = '#0a4d2a'}
                            onBlur={e => e.target.style.borderColor = '#d1d5db'}
                        />
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full py-2 px-4 rounded-lg text-white text-sm font-medium"
                        style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'Resetting...' : 'Reset password'}
                    </button>
                </form>
            </div>
            <p className="text-center text-xs mt-4" style={{ color: '#a8d5bb' }}>Protected by end-to-end encryption</p>
        </>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}