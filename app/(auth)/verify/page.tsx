'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

        if (code.length !== 6) {
            setError('Please enter the 6-digit code')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, userId }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error)
                return
            }

            router.push('/signin?verified=true')
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
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

            if (res.status === 429) {
                setError('Too many resend attempts. Please wait before trying again.')
                return
            }

            setResendMessage(data.message)
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setResendLoading(false)
        }
    }

    return (
        <>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#16181c' }}>
                Verify your email
            </h2>
            <p className="text-sm mb-6" style={{ color: '#5a6270' }}>
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
            </p>

            {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>
                    {error}
                </div>
            )}

            {resendMessage && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#e6f5ed', color: '#0a4d2a' }}>
                    {resendMessage}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    <label htmlFor="code" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        Verification code
                    </label>
                    <input
                        id="code"
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-3 py-2 rounded-lg border text-sm text-center tracking-widest"
                        style={{ borderColor: '#d1d5db', fontSize: '1.5rem' }}
                        placeholder="000000"
                        maxLength={6}
                        autoComplete="one-time-code"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Verifying...' : 'Verify email'}
                </button>
            </form>

            <div className="text-center mt-6">
                <p className="text-sm" style={{ color: '#5a6270' }}>
                    Did not receive the code?{' '}
                    <button
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="font-medium underline"
                        style={{ color: '#1a7a44' }}
                    >
                        {resendLoading ? 'Sending...' : 'Resend code'}
                    </button>
                </p>
            </div>
        </>
    )
}

export default function VerifyPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <VerifyForm />
        </Suspense>
    )
}