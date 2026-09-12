import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { forgotPasswordSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const result = forgotPasswordSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 422 }
            )
        }

        const { email } = result.data

        // Find user
        const user = await db.user.findUnique({
            where: { email }
        })

        // Always return success even if user not found
        // This prevents email enumeration
        if (!user || user.emailVerified) {
            return NextResponse.json({
                message: 'If your email is registered and unverified, a new code has been sent.'
            })
        }

        // Delete old codes for this user
        await db.verificationCode.deleteMany({
            where: { userId: user.id }
        })

        // Generate new code
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

        return NextResponse.json({
            message: 'If your email is registered and unverified, a new code has been sent.'
        })

    } catch (error) {
        console.error('Resend code error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}