import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { initiatePayment } from '@/lib/flutterwave'
import { generateTxRef, calculatePeriodEnd } from '@/lib/billing'
import { cookies } from 'next/headers'
import { signUpRateLimit } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
        const { success } = await signUpRateLimit.limit(`checkout:${ip}`)
        if (!success) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            )
        }

        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { planId } = body

        if (!planId) {
            return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
        }

        const plan = await db.plan.findUnique({ where: { id: planId } })
        if (!plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }

        if (plan.interval === 'FREE') {
            return NextResponse.json({ error: 'Cannot checkout free plan' }, { status: 400 })
        }

        const txRef = generateTxRef(user.id)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Log payment initiation
        await db.paymentLog.create({
            data: {
                userId: user.id,
                stage: 'INITIATED',
                amount: plan.amount,
                currency: plan.currency,
                providerReference: txRef,
                metadata: {
                    planId: plan.id,
                    planName: plan.name,
                    planInterval: plan.interval,
                },
            },
        })

        // Get payment link from Flutterwave
        const paymentLink = await initiatePayment({
            txRef,
            amount: plan.amount,
            currency: plan.currency,
            customerEmail: user.email,
            customerName: user.name,
            redirectUrl: `${appUrl}/billing/return`,
            meta: {
                planId: plan.id,
                userId: user.id,
            },
        })

        return NextResponse.json({ paymentLink, txRef })
    } catch (error) {
        console.error('Checkout error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}