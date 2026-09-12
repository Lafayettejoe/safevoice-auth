import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
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
        const { reason } = body

        const subscription = await db.subscription.findUnique({
            where: { userId: user.id },
            include: { plan: true },
        })

        if (!subscription) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
        }

        if (subscription.plan.interval === 'FREE') {
            return NextResponse.json({ error: 'Cannot cancel a free plan' }, { status: 400 })
        }

        if (subscription.cancelAtPeriodEnd) {
            return NextResponse.json({ error: 'Subscription is already scheduled for cancellation' }, { status: 400 })
        }

        // Set to cancel at period end — user keeps access until then
        const updated = await db.subscription.update({
            where: { userId: user.id },
            data: {
                cancelAtPeriodEnd: true,
                cancellationReason: reason || null,
            },
            include: { plan: true },
        })

        // Log the cancellation event
        await db.paymentLog.create({
            data: {
                userId: user.id,
                subscriptionId: subscription.id,
                stage: 'FULFILLED',
                amount: 0,
                currency: 'NGN',
                metadata: {
                    event: 'CANCELLATION_SCHEDULED',
                    reason: reason || 'No reason provided',
                    accessUntil: subscription.currentPeriodEnd.toISOString(),
                },
            },
        })

        return NextResponse.json({
            message: `Subscription cancelled. You will have access until ${updated.currentPeriodEnd.toLocaleDateString()}.`,
            subscription: updated,
        })
    } catch (error) {
        console.error('Cancel error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}