import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getOrCreateFreeSubscription } from '@/lib/billing'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const plans = await db.plan.findMany({
            orderBy: { amount: 'asc' },
        })

        const subscription = await getOrCreateFreeSubscription(user.id)

        return NextResponse.json({
            plans,
            subscription: {
                ...subscription,
                planInterval: subscription.plan.interval,
                planName: subscription.plan.name,
                planAmount: subscription.plan.amount,
            },
        })
    } catch (error) {
        console.error('Plans error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}