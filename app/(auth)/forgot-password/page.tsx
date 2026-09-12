'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!email.includes('@')) {
            setError('Please enter a valid email address')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })

            if (res.status === 429) {
                setError('Too many attempts. Please wait before trying again.')
                return
            }

            setSuccess(true)
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <>
                <div className="text-center">
                    <div className="text-4xl mb-4">📧</div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: '#16181c' }}>
                        Check your email
                    </h2>
                    <p className="text-sm mb-6" style={{ color: '#5a6270' }}>
                        If an account exists for <strong>{email}</strong>, we have sent a
                        password reset link. Check your inbox.
                    </p>
                    <Link href="/signin"
                        className="text-sm font-medium"
                        style={{ color: '#1a7a44' }}>
                        Back to sign in
                    </Link>
                </div>
            </>
        )
    }

    return (
        <>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#16181c' }}>
                Forgot your password?
            </h2>
            <p className="text-sm mb-6" style={{ color: '#5a6270' }}>
                Enter your email address and we will send you a reset link.
            </p>

            {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label htmlFor="email" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        Email address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#d1d5db' }}
                        placeholder="you@example.com"
                        autoComplete="email"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: '#5a6270' }}>
                Remember your password?{' '}
                <Link href="/signin" style={{ color: '#1a7a44', fontWeight: 500 }}>
                    Sign in
                </Link>
            </p>
        </>
    )
}