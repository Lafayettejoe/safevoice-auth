import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { resetPasswordSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const result = resetPasswordSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 422 }
            )
        }

        const { token, password } = result.data

        // Find the token in database
        const resetToken = await db.passwordResetToken.findUnique({
            where: { token }
        })

        // Token not found
        if (!resetToken) {
            return NextResponse.json(
                { error: 'Invalid or expired reset link. Please request a new one.' },
                { status: 400 }
            )
        }

        // Token already used
        if (resetToken.used) {
            return NextResponse.json(
                { error: 'This reset link has already been used. Please request a new one.' },
                { status: 400 }
            )
        }

        // Token expired
        if (resetToken.expiresAt < new Date()) {
            return NextResponse.json(
                { error: 'This reset link has expired. Please request a new one.' },
                { status: 400 }
            )
        }

        // Hash the new password
        const hashedPassword = await hashPassword(password)

        // Update the user's password
        await db.user.update({
            where: { id: resetToken.userId },
            data: { password: hashedPassword }
        })

        // Mark the token as used — single use enforcement
        await db.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true }
        })

        // Delete all sessions for this user
        // so they must sign in fresh with the new password
        await db.session.deleteMany({
            where: { userId: resetToken.userId }
        })

        return NextResponse.json({
            message: 'Password reset successfully. You can now sign in with your new password.'
        })

    } catch (error) {
        console.error('Reset password error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}