import { db } from './db'

// Plan amounts in kobo
export const PLAN_AMOUNTS = {
    FREE: 0,
    MONTHLY: 500000,   // ₦5,000
    YEARLY: 4800000,   // ₦48,000
} as const

// Get or create a free subscription for a user
export async function getOrCreateFreeSubscription(userId: string) {
    const existing = await db.subscription.findUnique({
        where: { userId },
        include: { plan: true },
    })

    if (existing) return existing

    const freePlan = await db.plan.findFirst({
        where: { interval: 'FREE' },
    })

    if (!freePlan) throw new Error('Free plan not found')

    return db.subscription.create({
        data: {
            userId,
            planId: freePlan.id,
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
        },
        include: { plan: true },
    })
}

// Calculate proration for mid-cycle upgrade
export function calculateProration(params: {
    currentPeriodStart: Date
    currentPeriodEnd: Date
    currentAmount: number
    newAmount: number
}): {
    daysRemaining: number
    totalDays: number
    creditAmount: number
    amountToCharge: number
    breakdown: string
} {
    const now = new Date()
    const totalMs = params.currentPeriodEnd.getTime() - params.currentPeriodStart.getTime()
    const remainingMs = params.currentPeriodEnd.getTime() - now.getTime()

    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24))
    const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))

    // Credit for unused portion of current plan
    const creditAmount = Math.floor((daysRemaining / totalDays) * params.currentAmount)

    // Amount to charge = new plan amount minus credit
    const amountToCharge = Math.max(0, params.newAmount - creditAmount)

    const breakdown = `Days remaining: ${daysRemaining} of ${totalDays} | Credit: ₦${(creditAmount / 100).toLocaleString()} | Amount to charge: ₦${(amountToCharge / 100).toLocaleString()}`

    return {
        daysRemaining,
        totalDays,
        creditAmount,
        amountToCharge,
        breakdown,
    }
}

// Calculate period end date for a plan
export function calculatePeriodEnd(interval: string, startDate: Date): Date {
    const date = new Date(startDate)
    if (interval === 'MONTHLY') {
        date.setMonth(date.getMonth() + 1)
    } else if (interval === 'YEARLY') {
        date.setFullYear(date.getFullYear() + 1)
    }
    return date
}

// Generate a unique transaction reference
export function generateTxRef(userId: string): string {
    return `SV-${userId.slice(-8)}-${Date.now()}`
}