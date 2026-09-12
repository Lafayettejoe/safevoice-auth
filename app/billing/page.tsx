'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Subscription {
    id: string
    status: string
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    cancellationReason: string | null
    planName: string
    planInterval: string
    planAmount: number
}

function BillingContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const downgrade = searchParams.get('downgrade')
    const success = searchParams.get('success')

    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (success) setMessage('Payment successful! Your subscription is now active.')
        if (downgrade) setMessage('Downgrade scheduled. Change applies at end of your current period.')
    }, [success, downgrade])

    useEffect(() => {
        fetch('/api/billing/plans')
            .then(r => r.json())
            .then(data => {
                setSubscription(data.subscription)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    async function handleCancel() {
        setCancelLoading(true)
        setError('')
        try {
            const res = await fetch('/api/billing/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: cancelReason }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error); return }
            setMessage(data.message)
            setShowCancelModal(false)
            // Refresh subscription data
            const refresh = await fetch('/api/billing/plans')
            const refreshData = await refresh.json()
            setSubscription(refreshData.subscription)
        } catch {
            setError('Something went wrong.')
        } finally {
            setCancelLoading(false)
        }
    }

    function formatAmount(amount: number) {
        if (amount === 0) return '₦0'
        return (amount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 })
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f0faf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading billing...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0faf4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            {/* Top nav */}
            <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2f0e8', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>SafeVoice</span>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ← Back to dashboard
                </button>
            </div>

            <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                    Billing
                </h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 32px' }}>
                    Manage your SafeVoice subscription
                </p>

                {message && (
                    <div style={{ marginBottom: '24px', padding: '14px', borderRadius: '10px', backgroundColor: '#e6f5ed', color: '#0a4d2a', fontSize: '13px', fontWeight: 500 }}>
                        {message}
                    </div>
                )}

                {error && (
                    <div style={{ marginBottom: '24px', padding: '14px', borderRadius: '10px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                {/* Subscription card */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)', border: '1px solid #e2f0e8', marginBottom: '16px' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Current plan</p>
                            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#16181c', margin: 0 }}>
                                {subscription?.planName}
                            </h2>
                            <p style={{ fontSize: '14px', color: '#0a4d2a', fontWeight: 500, margin: '4px 0 0' }}>
                                {formatAmount(subscription?.planAmount || 0)}
                                {subscription?.planInterval !== 'FREE' && (
                                    <span style={{ color: '#6b7280', fontWeight: 400 }}>
                                        {' '}/ {subscription?.planInterval === 'MONTHLY' ? 'month' : 'year'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div style={{
                            padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                            backgroundColor: subscription?.status === 'ACTIVE' ? '#e6f5ed' : '#fde8e8',
                            color: subscription?.status === 'ACTIVE' ? '#0a4d2a' : '#8b1a1a',
                        }}>
                            {subscription?.cancelAtPeriodEnd ? 'CANCELLING' : subscription?.status}
                        </div>
                    </div>

                    {subscription?.planInterval !== 'FREE' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f9fafb', border: '1px solid #f0faf4' }}>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Period started</p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: '#16181c', margin: 0 }}>
                                    {subscription?.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString() : '—'}
                                </p>
                            </div>
                            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f9fafb', border: '1px solid #f0faf4' }}>
                                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>
                                    {subscription?.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
                                </p>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: '#16181c', margin: 0 }}>
                                    {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}
                                </p>
                            </div>
                        </div>
                    )}

                    {subscription?.cancelAtPeriodEnd && subscription.cancellationReason && (
                        <div style={{ marginBottom: '20px', padding: '12px', borderRadius: '8px', backgroundColor: '#fdf3e3', border: '1px solid #e5b84a', fontSize: '13px', color: '#7a4a0a' }}>
                            Reason for cancellation: {subscription.cancellationReason}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => router.push('/billing/plans')}
                            style={{
                                flex: 1, padding: '10px 0', borderRadius: '8px',
                                border: 'none', backgroundColor: '#0a4d2a',
                                color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            {subscription?.planInterval === 'FREE' ? 'Upgrade plan' : 'Change plan'}
                        </button>

                        {subscription?.planInterval !== 'FREE' && !subscription?.cancelAtPeriodEnd && (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: '8px',
                                    border: '1px solid #e57373', backgroundColor: '#ffffff',
                                    color: '#8b1a1a', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Cancel subscription
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Cancel modal */}
            {showCancelModal && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '24px',
                }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Cancel your subscription?
                        </h3>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
                            You will keep access to your current plan until{' '}
                            <strong style={{ color: '#16181c' }}>
                                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : ''}
                            </strong>.
                            After that, you will move to the free plan.
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16181c', marginBottom: '6px' }}>
                                Reason for cancelling (optional)
                            </label>
                            <select
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', color: '#16181c', backgroundColor: '#ffffff', outline: 'none' }}
                            >
                                <option value="">Select a reason</option>
                                <option value="Too expensive">Too expensive</option>
                                <option value="Not using it enough">Not using it enough</option>
                                <option value="Missing features I need">Missing features I need</option>
                                <option value="Switching to another product">Switching to another product</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowCancelModal(false)}
                                style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Keep subscription
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancelLoading}
                                style={{ flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none', backgroundColor: '#8b1a1a', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: cancelLoading ? 'not-allowed' : 'pointer', opacity: cancelLoading ? 0.7 : 1 }}
                            >
                                {cancelLoading ? 'Cancelling...' : 'Yes, cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function BillingPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BillingContent />
        </Suspense>
    )
}