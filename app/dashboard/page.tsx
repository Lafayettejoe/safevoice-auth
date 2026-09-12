import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, getCurrentUser } from '@/lib/auth'

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (!token) {
        redirect('/signin')
    }

    const payload = verifySessionToken(token)
    if (!payload) {
        redirect('/signin')
    }

    const user = await getCurrentUser(token)
    if (!user) {
        redirect('/signin')
    }

    return (
        <div className="min-h-screen p-8" style={{ backgroundColor: '#f0faf4' }}>
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border p-8"
                    style={{ borderColor: '#d1d5db' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold" style={{ color: '#0a4d2a' }}>
                            SafeVoice
                        </h1>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="text-sm px-4 py-2 rounded-lg border font-medium"
                                style={{ borderColor: '#d1d5db', color: '#5a6270' }}
                            >
                                Sign out
                            </button>
                        </form>
                    </div>

                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#e6f5ed' }}>
                        <p className="text-sm font-medium" style={{ color: '#0a4d2a' }}>
                            You are signed in
                        </p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#16181c' }}>
                            Welcome, {user.name}
                        </p>
                        <p className="text-sm mt-1" style={{ color: '#5a6270' }}>
                            {user.email}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}