'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SigninPage() {
    const router = useRouter()
    const [form, setForm] = useState({ email: '', password: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [serverError, setServerError] = useState('')
    const [unverifiedUserId, setUnverifiedUserId] = useState('')

    function validate() {
        const newErrors: Record<string, string> = {}
        if (!form.email.includes('@')) newErrors.email = 'Please enter a valid email'
        if (form.password.length < 1) newErrors.password = 'Password is required'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
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

            router.push('/dashboard')
            router.refresh()
        } catch {
            setServerError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#16181c' }}>
                Sign in to SafeVoice
            </h2>

            {serverError && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>
                    {serverError}
                    {unverifiedUserId && (
                        <Link
                            href={`/verify?userId=${unverifiedUserId}&email=${encodeURIComponent(form.email)}`}
                            className="block mt-1 underline font-medium">
                            Verify your email
                        </Link>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        Email address
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: errors.email ? '#e57373' : '#d1d5db' }}
                        placeholder="you@example.com"
                        autoComplete="email"
                    />
                    {errors.email && (
                        <p className="text-xs mt-1" style={{ color: '#8b1a1a' }}>{errors.email}</p>
                    )}
                </div>

                <div className="mb-2">
                    <label htmlFor="password" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: errors.password ? '#e57373' : '#d1d5db' }}
                        placeholder="Your password"
                        autoComplete="current-password"
                    />
                    {errors.password && (
                        <p className="text-xs mt-1" style={{ color: '#8b1a1a' }}>{errors.password}</p>
                    )}
                </div>

                <div className="text-right mb-6">
                    <Link href="/forgot-password"
                        className="text-sm"
                        style={{ color: '#1a7a44' }}>
                        Forgot password?
                    </Link>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm"
                    style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: '#5a6270' }}>
                Do not have an account?{' '}
                <Link href="/signup" style={{ color: '#1a7a44', fontWeight: 500 }}>
                    Create one
                </Link>
            </p>
        </>
    )
}