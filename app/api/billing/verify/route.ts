import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { verifyTransaction } from '@/lib/flutterwave'
import { calculatePeriodEnd } from '@/lib/billing'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { transactionId, txRef } = body

        if (!transactionId) {
            return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
        }

        // Check idempotency — if already fulfilled, return early
        const existingLog = await db.paymentLog.findFirst({
            where: {
                providerReference: String(transactionId),
                stage: 'FULFILLED',
            },
        })

        if (existingLog) {
            return NextResponse.json({ message: 'Payment already processed' })
        }

        // Verify with Flutterwave
        const verification = await verifyTransaction(String(transactionId))

        if (verification.status !== 'successful') {
            // Log failure
            await db.paymentLog.create({
                data: {
                    userId: user.id,
                    stage: 'FAILED',
                    amount: verification.amount,
                    currency: verification.currency,
                    providerReference: String(transactionId),
                    metadata: { reason: 'Payment not successful', status: verification.status },
                },
            })
            return NextResponse.json({ error: 'Payment was not successful' }, { status: 400 })
        }

        // Log verification
        await db.paymentLog.create({
            data: {
                userId: user.id,
                stage: 'VERIFIED',
                amount: verification.amount,
                currency: verification.currency,
                providerReference: String(transactionId),
            },
        })

        // Find the initiation log to get plan details
        const initiationLog = await db.paymentLog.findFirst({
            where: {
                providerReference: txRef || verification.txRef,
                stage: 'INITIATED',
                userId: user.id,
            },
        })

        const metadata = initiationLog?.metadata as { planId?: string } | null
        const planId = metadata?.planId

        if (!planId) {
            return NextResponse.json({ error: 'Plan information not found' }, { status: 400 })
        }

        const plan = await db.plan.findUnique({ where: { id: planId } })
        if (!plan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 400 })
        }

        const now = new Date()
        const periodEnd = calculatePeriodEnd(plan.interval, now)

        // Create or update subscription
        const subscription = await db.subscription.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                planId: plan.id,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
            },
            update: {
                planId: plan.id,
                status: 'ACTIVE',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
            },
        })

        // Log fulfilment
        await db.paymentLog.create({
            data: {
                userId: user.id,
                subscriptionId: subscription.id,
                stage: 'FULFILLED',
                amount: verification.amount,
                currency: verification.currency,
                providerReference: String(transactionId),
                metadata: { planId: plan.id, planName: plan.name },
            },
        })

        return NextResponse.json({
            message: 'Payment verified and subscription activated',
            subscription,
        })
    } catch (error) {
        console.error('Verify error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}