'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
    const router = useRouter()
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(false)
    const [serverError, setServerError] = useState('')

    function validate() {
        const newErrors: Record<string, string> = {}
        if (form.name.length < 2) newErrors.name = 'Name must be at least 2 characters'
        if (!form.email.includes('@')) newErrors.email = 'Please enter a valid email'
        if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(form.password)) newErrors.password = 'Password must contain an uppercase letter'
        if (!/[0-9]/.test(form.password)) newErrors.password = 'Password must contain a number'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
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

            if (!res.ok) {
                setServerError(data.error)
                return
            }

            router.push(`/verify?userId=${data.userId}&email=${encodeURIComponent(form.email)}`)
        } catch {
            setServerError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <h2 className="text-2xl font-bold mb-6" style={{ color: '#16181c' }}>
                Create your account
            </h2>

            {serverError && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                    style={{ backgroundColor: '#fde8e8', color: '#8b1a1a' }}>
                    {serverError}
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium mb-1"
                        style={{ color: '#16181c' }}>
                        Full name
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: errors.name ? '#e57373' : '#d1d5db' }}
                        placeholder="Faith Joseph"
                        autoComplete="name"
                    />
                    {errors.name && (
                        <p className="text-xs mt-1" style={{ color: '#8b1a1a' }}>{errors.name}</p>
                    )}
                </div>

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

                <div className="mb-6">
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
                        placeholder="Min 8 chars, one uppercase, one number"
                        autoComplete="new-password"
                    />
                    {errors.password && (
                        <p className="text-xs mt-1" style={{ color: '#8b1a1a' }}>{errors.password}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 rounded-lg text-white font-medium text-sm transition-opacity"
                    style={{ backgroundColor: '#0a4d2a', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Creating account...' : 'Create account'}
                </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: '#5a6270' }}>
                Already have an account?{' '}
                <Link href="/signin" style={{ color: '#1a7a44', fontWeight: 500 }}>
                    Sign in
                </Link>
            </p>
        </>
    )
}