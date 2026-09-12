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
        if (password.length < 8) return 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
        if (!/[0-9]/.test(password)) return 'Password must contain a number'
        return ''
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        const validationError = validate()
        if (validationError) {
            setError(validationError)
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error)
                return
            }

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
            <div className="text-center">
                <p className="text-sm" style={{ color: '#8b1a1a' }}>
                    Invalid reset link. Please request a new one.
                </p>
                <Link href="/forgot-password"
                    className="text-sm font-medium mt-2 block"
                    style={{ color: '#1a7a44' }}>
                    Request new link
                </Link>
            </div>
        )
    }

    if (success) {
        return (
            <div className="text-center">
                <div className="text-4xl mb-4">✅</div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: '#16181c' }}>
                    Password reset
                </h2>
                <p className="text-sm" style={{ color: '#5a6270' }}>
                    Your password has been reset successfully. Redirecting to sign in...
                </p>
            </div>
        )
    }

    return (
        <>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#16181c' }}>
                Reset your password
            </h2>
            <p className="text-sm mb-6" style={{ color: '#5a6270' }}>
                Enter your new password below.
            </p>

            {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label htmlFor="password" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        New password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: error ? '#e57373' : '#d1d5db' }}
                        placeholder="Min 8 chars, one uppercase, one number"
                        autoComplete="new-password"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Resetting...' : 'Reset password'}
                </button>
            </form>
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