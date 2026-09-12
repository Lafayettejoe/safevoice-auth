import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken } from '@/lib/auth'
import { signinSchema } from '@/lib/validations'
import { signInRateLimit } from '@/lib/ratelimit'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
        const { success, limit, remaining, reset } = await signInRateLimit.limit(ip)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many sign in attempts. Please try again in 15 minutes.' },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': limit.toString(),
                        'X-RateLimit-Remaining': remaining.toString(),
                        'X-RateLimit-Reset': reset.toString(),
                        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
                    }
                }
            )
        }

        const body = await request.json()

        // Validate input
        const result = signinSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 422 }
            )
        }

        const { email, password } = result.data

        // Find the user
        const user = await db.user.findUnique({
            where: { email }
        })

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            )
        }

        // Check password
        const passwordValid = await verifyPassword(password, user.password)
        if (!passwordValid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            )
        }

        // Check email is verified
        if (!user.emailVerified) {
            return NextResponse.json(
                { error: 'Please verify your email before signing in', userId: user.id },
                { status: 403 }
            )
        }

        // Create session token
        const token = createSessionToken(user.id)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        // Save session to database
        await db.session.create({
            data: {
                userId: user.id,
                expiresAt,
            }
        })

        // Set cookie
        const cookieStore = await cookies()
        cookieStore.set('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: expiresAt,
            path: '/',
        })

        return NextResponse.json({
            message: 'Signed in successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        })

    } catch (error) {
        console.error('Signin error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}