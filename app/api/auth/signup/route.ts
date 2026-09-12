import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendVerificationEmail, generateVerificationCode } from '@/lib/email'
import { signupSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Server-side validation
        const result = signupSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.errors[0].message },
                { status: 422 }
            )
        }

        const { name, email, password } = result.data

        // Check if email already exists
        const existingUser = await db.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            )
        }

        // Hash the password
        const hashedPassword = await hashPassword(password)

        // Create the user
        const user = await db.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        })

        // Generate verification code
        const code = generateVerificationCode()
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

        // Save verification code to database
        await db.verificationCode.create({
            data: {
                userId: user.id,
                email: user.email,
                code,
                expiresAt,
            }
        })

        // Send verification email
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