import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET — view one record
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { publicId } = await params

        // Scope to userId AND publicId in one query
        // If the record exists but belongs to another user
        // this returns null — not a 403, just not found
        // This prevents leaking that a record exists
        const note = await db.caseNote.findFirst({
            where: {
                publicId,
                userId: user.id,
            },
            select: {
                publicId: true,
                title: true,
                content: true,
                createdAt: true,
                updatedAt: true,
            },
        })

        if (!note) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        return NextResponse.json({ note })

    } catch (error) {
        console.error('GET record error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

// DELETE — delete one record and write audit log first
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { publicId } = await params

        // Find the record — scoped to userId
        const note = await db.caseNote.findFirst({
            where: {
                publicId,
                userId: user.id,
            },
        })

        if (!note) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        // Check ownership explicitly for the 403 case
        // If somehow the note.userId differs, return 403
        if (note.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Write audit log BEFORE deleting
        // so the record still exists when the audit is written
        await db.auditLog.create({
            data: {
                userId: user.id,
                action: 'DELETE',
                entityType: 'CaseNote',
                entityId: note.publicId,
                metadata: {
                    title: note.title,
                    deletedAt: new Date().toISOString(),
                },
            },
        })

        // Now delete the record
        await db.caseNote.delete({
            where: { id: note.id },
        })

        return NextResponse.json({
            message: 'Record deleted and audit log written',
        })

    } catch (error) {
        console.error('DELETE record error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}