'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ReturnContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const status = searchParams.get('status')
    const transactionId = searchParams.get('transaction_id')
    const txRef = searchParams.get('tx_ref')

    const [verifying, setVerifying] = useState(true)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!transactionId) {
            setError('No transaction ID found. Please contact support.')
            setVerifying(false)
            return
        }

        if (status !== 'successful') {
            setError('Payment was not completed. Please try again.')
            setVerifying(false)
            return
        }

        // Verify the transaction server-side
        fetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId, txRef }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    setError(data.error)
                } else {
                    setSuccess(true)
                    setTimeout(() => router.push('/billing?success=true'), 2000)
                }
            })
            .catch(() => setError('Verification failed. Please contact support.'))
            .finally(() => setVerifying(false))
    }, [transactionId, txRef, status, router])

    return (
        <div style={{
            minHeight: '100vh', backgroundColor: '#f0faf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            padding: '24px',
        }}>
            <div style={{
                backgroundColor: '#ffffff', borderRadius: '16px', padding: '48px 40px',
                textAlign: 'center', maxWidth: '420px', width: '100%',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
                border: '1px solid #e2f0e8',
            }}>
                {verifying && (
                    <>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Verifying your payment
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                            Please wait while we confirm your payment with Flutterwave...
                        </p>
                    </>
                )}

                {!verifying && success && (
                    <>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Payment confirmed
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                            Your subscription is now active. Redirecting to billing...
                        </p>
                    </>
                )}

                {!verifying && error && (
                    <>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Something went wrong
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
                            {error}
                        </p>
                        <button
                            onClick={() => router.push('/billing/plans')}
                            style={{
                                padding: '10px 24px', borderRadius: '8px', border: 'none',
                                backgroundColor: '#0a4d2a', color: '#ffffff',
                                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            Try again
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default function BillingReturnPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ReturnContent />
        </Suspense>
    )
}