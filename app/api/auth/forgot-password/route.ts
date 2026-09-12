import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { forgotPasswordSchema } from '@/lib/validations'
import crypto from 'crypto'

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

        // Always return success to prevent email enumeration
        if (!user) {
            return NextResponse.json({
                message: 'If an account exists with this email, a reset link has been sent.'
            })
        }

        // Delete any existing reset tokens for this user
        await db.passwordResetToken.deleteMany({
            where: { userId: user.id }
        })

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        // Save token to database
        await db.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt,
            }
        })

        // Send reset email
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`
        await sendPasswordResetEmail(email, resetUrl)

        return NextResponse.json({
            message: 'If an account exists with this email, a reset link has been sent.'
        })

    } catch (error) {
        console.error('Forgot password error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}