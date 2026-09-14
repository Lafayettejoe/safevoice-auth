import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, getCurrentUser } from '@/lib/auth'

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    if (!token) redirect('/signin')

    const payload = verifySessionToken(token)
    if (!payload) redirect('/signin')

    const user = await getCurrentUser(token)
    if (!user) redirect('/signin')

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
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#0a4d2a' }}>
                    SafeVoice
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
                    <form action="/api/auth/signout" method="POST">
                        <button type="submit" style={{
                            padding: '6px 16px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#ffffff',
                            color: '#374151',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}>
                            Sign out
                        </button>
                    </form>
                </div>
            </div>

            {/* Page content */}
            <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 24px' }}>

                {/* Welcome card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '40px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(10,77,42,0.08)',
                    border: '1px solid #e2f0e8',
                    marginBottom: '16px',
                }}>
                    <h1 style={{
                        fontSize: '26px',
                        fontWeight: 700,
                        color: '#16181c',
                        margin: '0 0 8px',
                    }}>
                        Welcome back, {user.name}!
                    </h1>
                    <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0 0 28px',
                        lineHeight: 1.6,
                    }}>
                        You have successfully authenticated and verified your email address.
                        This is the protected dashboard area.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>Your User ID:</span>
                        <code style={{
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#f0faf4',
                            color: '#0a4d2a',
                            border: '1px solid #e2f0e8',
                        }}>
                            {user.id}
                        </code>
                    </div>
                </div>

                {/* Billing card — separate, below the welcome card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px 32px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    border: '1px solid #e2f0e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#16181c',
                            margin: '0 0 2px',
                        }}>
                            Subscription
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            Manage your SafeVoice plan
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <a href="/billing/plans" style={{ textDecoration: 'none' }}>
                            <button style={{
                                padding: '9px 20px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: '#374151',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}>
                                View plans
                            </button>
                        </a>
                        <a href="/billing" style={{ textDecoration: 'none' }}>
                            <button style={{
                                padding: '9px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#0a4d2a',
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}>
                                Manage billing
                            </button>
                        </a>
                    </div>
                </div>

                {/* AI Upload card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px 32px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    border: '1px solid #e2f0e8',
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#16181c', margin: '0 0 2px' }}>
                            AI Voice Analysis
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            Upload a voice recording for transcription and risk classification
                        </p>
                    </div>
                    <a href="/upload" style={{ textDecoration: 'none' }}>
                        <button style={{
                            padding: '9px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#0a4d2a',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}>
                            Upload recording
                        </button>
                    </a>
                </div>

                {/* Records card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px 32px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    border: '1px solid #e2f0e8',
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#16181c', margin: '0 0 2px' }}>
                            Case Notes
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            Create, view, and manage your case notes
                        </p>
                    </div>
                    <a href="/records?view=list" style={{ textDecoration: 'none' }}>
                        <button style={{
                            padding: '9px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#0a4d2a',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}>
                            View records
                        </button>
                    </a>
                </div>

            </div>
        </div>
    )
}