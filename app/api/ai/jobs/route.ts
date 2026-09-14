import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const jobId = searchParams.get('jobId')

        if (jobId) {
            // Get specific job
            const job = await db.aIJob.findFirst({
                where: { id: jobId, userId: user.id },
            })

            if (!job) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 })
            }

            return NextResponse.json({ job })
        }

        // Get all jobs for this user
        const jobs = await db.aIJob.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })

        return NextResponse.json({ jobs })

    } catch (error) {
        console.error('Jobs route error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}