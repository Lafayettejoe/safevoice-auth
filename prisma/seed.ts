import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
    // Delete existing plans to avoid duplicates
    await db.plan.deleteMany()

    await db.plan.createMany({
        data: [
            {
                name: 'Free',
                interval: 'FREE',
                amount: 0,
                currency: 'NGN',
            },
            {
                name: 'Monthly',
                interval: 'MONTHLY',
                amount: 500000, // ₦5,000 in kobo
                currency: 'NGN',
            },
            {
                name: 'Yearly',
                interval: 'YEARLY',
                amount: 4800000, // ₦48,000 in kobo
                currency: 'NGN',
            },
        ],
    })

    console.log('Plans seeded successfully')
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect())