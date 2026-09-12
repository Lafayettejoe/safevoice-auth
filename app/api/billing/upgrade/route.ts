import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { initiatePayment } from '@/lib/flutterwave'
import { calculateProration, generateTxRef, calculatePeriodEnd } from '@/lib/billing'
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
        const { planId } = body

        if (!planId) {
            return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
        }

        const newPlan = await db.plan.findUnique({ where: { id: planId } })
        if (!newPlan) {
            return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }

        const subscription = await db.subscription.findUnique({
            where: { userId: user.id },
            include: { plan: true },
        })

        if (!subscription) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
        }

        // Downgrade — apply at end of current period
        if (newPlan.amount < subscription.plan.amount) {
            const updated = await db.subscription.update({
                where: { userId: user.id },
                data: {
                    cancelAtPeriodEnd: true,
                    cancellationReason: `Downgrade to ${newPlan.name} at period end`,
                },
            })

            await db.paymentLog.create({
                data: {
                    userId: user.id,
                    subscriptionId: subscription.id,
                    stage: 'FULFILLED',
                    amount: 0,
                    currency: 'NGN',
                    metadata: {
                        event: 'DOWNGRADE_SCHEDULED',
                        newPlanId: newPlan.id,
                        newPlanName: newPlan.name,
                        effectiveDate: subscription.currentPeriodEnd.toISOString(),
                    },
                },
            })

            return NextResponse.json({
                message: `Downgrade to ${newPlan.name} scheduled. Change applies at end of current period.`,
                effectiveDate: subscription.currentPeriodEnd,
            })
        }

        // Upgrade — charge prorated amount now
        const proration = calculateProration({
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            currentAmount: subscription.plan.amount,
            newAmount: newPlan.amount,
        })

        const txRef = generateTxRef(user.id)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Log initiation with proration details
        await db.paymentLog.create({
            data: {
                userId: user.id,
                subscriptionId: subscription.id,
                stage: 'INITIATED',
                amount: proration.amountToCharge,
                currency: newPlan.currency,
                providerReference: txRef,
                metadata: {
                    planId: newPlan.id,
                    planName: newPlan.name,
                    isUpgrade: true,
                    proration: proration.breakdown,
                    creditAmount: proration.creditAmount,
                    daysRemaining: proration.daysRemaining,
                    totalDays: proration.totalDays,
                },
            },
        })

        const paymentLink = await initiatePayment({
            txRef,
            amount: proration.amountToCharge,
            currency: newPlan.currency,
            customerEmail: user.email,
            customerName: user.name,
            redirectUrl: `${appUrl}/billing/return`,
            meta: {
                planId: newPlan.id,
                userId: user.id,
                isUpgrade: 'true',
            },
        })

        return NextResponse.json({
            paymentLink,
            txRef,
            proration: {
                daysRemaining: proration.daysRemaining,
                totalDays: proration.totalDays,
                creditAmount: proration.creditAmount,
                amountToCharge: proration.amountToCharge,
                breakdown: proration.breakdown,
            },
        })
    } catch (error) {
        console.error('Upgrade error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}