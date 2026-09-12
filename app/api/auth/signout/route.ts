import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value

        if (token) {
            const payload = verifySessionToken(token)
            if (payload) {
                // Delete session from database
                await db.session.deleteMany({
                    where: { userId: payload.userId }
                })
            }
        }

        // Clear the cookie
        cookieStore.set('session', '', {
            httpOnly: true,
            expires: new Date(0),
            path: '/',
        })

        return NextResponse.json({
            message: 'Signed out successfully'
        })

    } catch (error) {
        console.error('Signout error:', error)
        return NextResponse.json(
            { error: 'Something went wrong.' },
            { status: 500 }
        )
    }
}