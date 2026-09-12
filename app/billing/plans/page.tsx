'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
    id: string
    name: string
    interval: string
    amount: number
    currency: string
}

interface Subscription {
    planInterval: string
    planName: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    status: string
}

export default function PlansPage() {
    const router = useRouter()
    const [plans, setPlans] = useState<Plan[]>([])
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch('/api/billing/plans')
            .then(r => r.json())
            .then(data => {
                setPlans(data.plans || [])
                setSubscription(data.subscription || null)
                setLoading(false)
            })
            .catch(() => {
                setError('Failed to load plans')
                setLoading(false)
            })
    }, [])

    async function handleSelect(plan: Plan) {
        if (plan.interval === 'FREE') return
        if (plan.interval === subscription?.planInterval) return

        setCheckoutLoading(plan.id)
        setError('')

        try {
            const isUpgrade =
                (plan.interval === 'YEARLY' && subscription?.planInterval === 'MONTHLY')

            const endpoint = isUpgrade ? '/api/billing/upgrade' : '/api/billing/checkout'

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.id }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.error)
                return
            }

            if (data.paymentLink) {
                window.location.href = data.paymentLink
            } else if (data.effectiveDate) {
                router.push('/billing?downgrade=true')
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setCheckoutLoading(null)
        }
    }

    function formatAmount(amount: number, interval: string) {
        if (amount === 0) return 'Free'
        const naira = (amount / 100).toLocaleString('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
        })
        return `${naira} / ${interval === 'MONTHLY' ? 'month' : 'year'}`
    }

    function getButtonLabel(plan: Plan) {
        if (plan.interval === subscription?.planInterval) return 'Current plan'
        if (plan.interval === 'FREE') return 'Free plan'
        if (
            plan.interval === 'YEARLY' &&
            subscription?.planInterval === 'MONTHLY'
        ) return 'Upgrade'
        if (
            plan.interval === 'MONTHLY' &&
            subscription?.planInterval === 'YEARLY'
        ) return 'Downgrade'
        return 'Subscribe'
    }

    function isCurrentPlan(plan: Plan) {
        return plan.interval === subscription?.planInterval
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#f0faf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading plans...</p>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0faf4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

            {/* Top nav */}
            <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2f0e8', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>SafeVoice</span>
                <button
                    onClick={() => router.push('/billing')}
                    style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    ← Back to billing
                </button>
            </div>

            <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                    Choose your plan
                </h1>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 32px' }}>
                    Unlock SafeVoice for your camp. Cancel anytime.
                </p>

                {error && (
                    <div style={{ marginBottom: '24px', padding: '12px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {plans.map(plan => (
                        <div
                            key={plan.id}
                            style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '16px',
                                padding: '28px 24px',
                                border: isCurrentPlan(plan) ? '2px solid #0a4d2a' : '1px solid #e2f0e8',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                position: 'relative',
                            }}
                        >
                            {isCurrentPlan(plan) && (
                                <div style={{
                                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                                    backgroundColor: '#0a4d2a', color: '#ffffff', fontSize: '11px',
                                    fontWeight: 700, padding: '3px 12px', borderRadius: '99px',
                                }}>
                                    CURRENT PLAN
                                </div>
                            )}

                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                                {plan.name}
                            </h2>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: '#0a4d2a', margin: '0 0 20px' }}>
                                {formatAmount(plan.amount, plan.interval)}
                            </p>

                            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                                {plan.interval === 'FREE' && (
                                    <>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ 1 camp</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ Basic reporting</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280' }}>✓ 1 case worker</li>
                                    </>
                                )}
                                {plan.interval === 'MONTHLY' && (
                                    <>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ Up to 3 camps</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ AI transcription</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280' }}>✓ 5 case workers</li>
                                    </>
                                )}
                                {plan.interval === 'YEARLY' && (
                                    <>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ Unlimited camps</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ AI transcription</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>✓ Unlimited case workers</li>
                                        <li style={{ fontSize: '13px', color: '#6b7280' }}>✓ Save ₦12,000/year</li>
                                    </>
                                )}
                            </ul>

                            <button
                                onClick={() => handleSelect(plan)}
                                disabled={isCurrentPlan(plan) || checkoutLoading === plan.id}
                                style={{
                                    width: '100%', padding: '10px 0', borderRadius: '8px',
                                    border: isCurrentPlan(plan) ? '1px solid #d1d5db' : 'none',
                                    backgroundColor: isCurrentPlan(plan) ? '#ffffff' : '#0a4d2a',
                                    color: isCurrentPlan(plan) ? '#6b7280' : '#ffffff',
                                    fontSize: '13px', fontWeight: 600,
                                    cursor: isCurrentPlan(plan) ? 'default' : 'pointer',
                                    opacity: checkoutLoading === plan.id ? 0.7 : 1,
                                }}
                            >
                                {checkoutLoading === plan.id ? 'Loading...' : getButtonLabel(plan)}
                            </button>
                        </div>
                    ))}
                </div>

                {subscription?.cancelAtPeriodEnd && (
                    <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', backgroundColor: '#fdf3e3', border: '1px solid #e5b84a', fontSize: '13px', color: '#7a4a0a' }}>
                        Your subscription is scheduled to cancel on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. You will retain access until then.
                    </div>
                )}
            </div>
        </div>
    )
}