import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const createSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
    content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
})

// GET — list all records belonging to the authenticated user
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Query scoped to userId inside the query itself
        // never fetch all then filter
        const notes = await db.caseNote.findMany({
            where: { userId: user.id },
            select: {
                publicId: true,
                title: true,
                content: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({ notes })

    } catch (error) {
        console.error('GET records error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

// POST — create a new record
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = createSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 422 }
            )
        }

        const note = await db.caseNote.create({
            data: {
                userId: user.id,
                title: parsed.data.title,
                content: parsed.data.content,
            },
            select: {
                publicId: true,
                title: true,
                content: true,
                createdAt: true,
            },
        })

        return NextResponse.json({ note }, { status: 201 })

    } catch (error) {
        console.error('POST records error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}