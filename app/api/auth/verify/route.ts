import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verificationCodeSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate input
        const result = verificationCodeSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 422 }
            )
        }

        const { code } = result.data
        const userId = body.userId

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // Find the verification code
        const verificationCode = await db.verificationCode.findFirst({
            where: {
                userId,
                code,
            }
        })

        if (!verificationCode) {
            return NextResponse.json(
                { error: 'Invalid verification code' },
                { status: 400 }
            )
        }

        // Check if code has expired
        if (verificationCode.expiresAt < new Date()) {
            return NextResponse.json(
                { error: 'Verification code has expired. Please request a new one.' },
                { status: 400 }
            )
        }

        // Mark user as verified
        await db.user.update({
            where: { id: userId },
            data: { emailVerified: true }
        })

        // Delete the used verification code
        await db.verificationCode.delete({
            where: { id: verificationCode.id }
        })

        return NextResponse.json({
            message: 'Email verified successfully. You can now sign in.'
        })

    } catch (error) {
        console.error('Verification error:', error)
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}