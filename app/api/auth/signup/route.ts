import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { signupSchema } from '@/lib/validations'
import { signUpRateLimit } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
        const { success, limit, remaining, reset } = await signUpRateLimit.limit(ip)

        if (!success) {
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.' },
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

        const result = signupSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 422 }
            )
        }

        const { name, email, password } = result.data

        const existingUser = await db.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            )
        }

        const hashedPassword = await hashPassword(password)

        const user = await db.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        })

        const code = generateVerificationCode()
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

        await db.verificationCode.create({
            data: {
                userId: user.id,
                email: user.email,
                code,
                expiresAt,
            }
        })

        await sendVerificationEmail(email, code)

        return NextResponse.json(
            {
                message: 'Account created. Please check your email for your verification code.',
                userId: user.id,
            },
            { status: 201 }
        )

    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}