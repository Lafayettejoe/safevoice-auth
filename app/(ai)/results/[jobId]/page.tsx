'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface Job {
    id: string
    status: string
    fileName: string
    fileSize: number
    transcriptText: string | null
    riskLevel: string | null
    riskRationale: string | null
    errorMessage: string | null
    attempts: number
    createdAt: string
}

const RISK_STYLES = {
    HIGH: { bg: '#fde8e8', color: '#8b1a1a', border: '#e57373' },
    MEDIUM: { bg: '#fdf3e3', color: '#7a4a0a', border: '#e5b84a' },
    LOW: { bg: '#e6f5ed', color: '#0a4d2a', border: '#a8d5bb' },
}

export default function ResultsPage({
    params,
}: {
    params: Promise<{ jobId: string }>
}) {
    const { jobId } = use(params)
    const router = useRouter()

    const [job, setJob] = useState<Job | null>(null)
    const [loading, setLoading] = useState(true)
    const [followupLoading, setFollowupLoading] = useState(false)
    const [followupResult, setFollowupResult] = useState('')
    const [followupAction, setFollowupAction] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        let interval: NodeJS.Timeout

        async function fetchJob() {
            try {
                const res = await fetch(`/api/ai/jobs?jobId=${jobId}`)
                const data = await res.json()

                if (data.job) {
                    setJob(data.job)
                    setLoading(false)

                    if (data.job.status === 'COMPLETE' || data.job.status === 'FAILED') {
                        clearInterval(interval)
                    }
                }
            } catch {
                setError('Failed to fetch job status')
                setLoading(false)
                clearInterval(interval)
            }
        }

        fetchJob()
        interval = setInterval(fetchJob, 3000)

        return () => clearInterval(interval)
    }, [jobId])

    async function handleFollowup(action: 'summarise' | 'expand' | 'suggest') {
        setFollowupLoading(true)
        setFollowupResult('')
        setFollowupAction(action)

        try {
            const res = await fetch('/api/ai/followup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, action }),
            })

            const data = await res.json()
            if (!res.ok) { setError(data.error); return }
            setFollowupResult(data.result)
        } catch {
            setError('Follow-up action failed')
        } finally {
            setFollowupLoading(false)
        }
    }

    function getRiskStyle(level: string) {
        return RISK_STYLES[level as keyof typeof RISK_STYLES] || RISK_STYLES.LOW
    }

    function parseRationale(raw: string | null) {
        if (!raw) return null
        try {
            return JSON.parse(raw)
        } catch {
            return { rationale: raw, suggestedActions: [] }
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f0faf4',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
            {/* Top nav */}
            <div style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2f0e8',
                padding: '0 32px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>SafeVoice</span>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <a href="/upload" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, textDecoration: 'none' }}>
                        New upload
                    </a>
                    <a href="/dashboard" style={{ fontSize: '13px', color: '#1a7a44', fontWeight: 500, textDecoration: 'none' }}>
                        ← Dashboard
                    </a>
                </div>
            </div>

            <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 24px' }}>

                {/* Processing state */}
                {(loading || job?.status === 'PROCESSING' || job?.status === 'PENDING') && (
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '48px 40px',
                        textAlign: 'center',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        border: '1px solid #e2f0e8',
                    }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Processing your recording
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px' }}>
                            Transcribing audio with Whisper, then classifying risk with GPT-4o-mini...
                        </p>
                        <p style={{ fontSize: '12px', color: '#a8d5bb', margin: 0 }}>
                            This usually takes 15 to 30 seconds. This page updates automatically.
                        </p>
                    </div>
                )}

                {/* Failed state */}
                {job?.status === 'FAILED' && (
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '40px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        border: '1px solid #e57373',
                    }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#16181c', margin: '0 0 8px' }}>
                            Processing failed
                        </h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px' }}>
                            {job.errorMessage || 'An unknown error occurred'}
                        </p>
                        <p style={{ fontSize: '12px', color: '#8b1a1a', margin: '0 0 24px' }}>
                            Attempted {job.attempts} time{job.attempts !== 1 ? 's' : ''}.
                        </p>
                        <button
                            onClick={() => router.push('/upload')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#0a4d2a',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Complete state */}
                {job?.status === 'COMPLETE' && (
                    <>
                        {/* Header */}
                        <div style={{ marginBottom: '16px' }}>
                            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#16181c', margin: '0 0 4px' }}>
                                Analysis complete
                            </h1>
                            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                {job.fileName} · {(job.fileSize / (1024 * 1024)).toFixed(2)} MB ·{' '}
                                {new Date(job.createdAt).toLocaleString()}
                            </p>
                        </div>

                        {/* Risk level card */}
                        {job.riskLevel && (
                            <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '16px',
                                padding: '24px 28px',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                border: `1px solid ${getRiskStyle(job.riskLevel).border}`,
                                marginBottom: '16px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <span style={{
                                        padding: '4px 14px',
                                        borderRadius: '99px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        backgroundColor: getRiskStyle(job.riskLevel).bg,
                                        color: getRiskStyle(job.riskLevel).color,
                                    }}>
                                        {job.riskLevel} RISK
                                    </span>
                                    <span style={{ fontSize: '13px', color: '#6b7280' }}>AI classification</span>
                                </div>

                                {(() => {
                                    const rationale = parseRationale(job.riskRationale)
                                    return rationale ? (
                                        <>
                                            <p style={{ fontSize: '14px', color: '#16181c', margin: '0 0 12px', lineHeight: 1.6 }}>
                                                {rationale.rationale}
                                            </p>
                                            {rationale.suggestedActions?.length > 0 && (
                                                <div>
                                                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        Suggested actions
                                                    </p>
                                                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                                                        {rationale.suggestedActions.map((action: string, i: number) => (
                                                            <li key={i} style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                                                                {action}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    ) : null
                                })()}
                            </div>
                        )}

                        {/* Transcript card */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            padding: '24px 28px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            border: '1px solid #e2f0e8',
                            marginBottom: '16px',
                        }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Transcript
                            </p>
                            <p style={{ fontSize: '14px', color: '#16181c', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                {job.transcriptText || 'No transcript available'}
                            </p>
                        </div>

                        {/* Follow-up actions */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            padding: '24px 28px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            border: '1px solid #e2f0e8',
                        }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Follow-up actions
                            </p>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: followupResult ? '20px' : 0 }}>
                                {(['summarise', 'expand', 'suggest'] as const).map(action => (
                                    <button
                                        key={action}
                                        onClick={() => handleFollowup(action)}
                                        disabled={followupLoading}
                                        style={{
                                            padding: '8px 18px',
                                            borderRadius: '8px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: followupAction === action && followupResult ? '#0a4d2a' : '#ffffff',
                                            color: followupAction === action && followupResult ? '#ffffff' : '#374151',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: followupLoading ? 'not-allowed' : 'pointer',
                                            opacity: followupLoading ? 0.7 : 1,
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {followupLoading && followupAction === action ? 'Loading...' : action}
                                    </button>
                                ))}
                            </div>

                            {followupResult && (
                                <div style={{
                                    padding: '16px',
                                    borderRadius: '10px',
                                    backgroundColor: '#f0faf4',
                                    border: '1px solid #e2f0e8',
                                }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#0a4d2a', margin: '0 0 8px', textTransform: 'capitalize' }}>
                                        {followupAction}
                                    </p>
                                    <p style={{ fontSize: '14px', color: '#16181c', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                        {followupResult}
                                    </p>
                                </div>
                            )}

                            {error && (
                                <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', backgroundColor: '#fde8e8', color: '#8b1a1a', fontSize: '13px' }}>
                                    {error}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}