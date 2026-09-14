import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { transcribeAudio } from '@/lib/ai/transcribe'
import { classifyTranscript } from '@/lib/ai/classify'
import { AI_CONFIG } from '@/lib/ai/config'
import { cookies } from 'next/headers'
import { z } from 'zod'

const processSchema = z.object({
    fileKey: z.string().min(1),
    fileUrl: z.string().url(),
    fileName: z.string().min(1),
    fileSize: z.number().positive(),
})

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = processSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 422 }
            )
        }

        const { fileKey, fileUrl, fileName, fileSize } = parsed.data

        // Create the job record immediately
        const job = await db.aIJob.create({
            data: {
                userId: user.id,
                fileKey,
                fileName,
                fileSize,
                status: 'PROCESSING',
                attempts: 1,
            },
        })

        // Process in background — do not await so the response returns immediately
        processJobInBackground(job.id, fileUrl, fileName).catch(async (error) => {
            console.error('Background job failed:', error)
            await db.aIJob.update({
                where: { id: job.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Unknown error',
                },
            })
        })

        return NextResponse.json({
            jobId: job.id,
            message: 'Processing started. Check job status for results.',
        })
    } catch (error) {
        console.error('Process route error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

async function processJobInBackground(
    jobId: string,
    fileUrl: string,
    fileName: string
) {
    let attempts = 0

    while (attempts < AI_CONFIG.jobs.maxAttempts) {
        attempts++

        try {
            // Step 1: Transcribe
            const { transcript } = await transcribeAudio(fileUrl, fileName)

            // Step 2: Classify
            const classification = await classifyTranscript(transcript)

            // Step 3: Update job as complete
            await db.aIJob.update({
                where: { id: jobId },
                data: {
                    status: 'COMPLETE',
                    attempts,
                    transcriptText: transcript,
                    riskLevel: classification.riskLevel,
                    riskRationale: JSON.stringify({
                        rationale: classification.rationale,
                        suggestedActions: classification.suggestedActions,
                    }),
                },
            })

            return // Success — exit the retry loop

        } catch (error) {
            console.error(`Job ${jobId} attempt ${attempts} failed:`, error)

            if (attempts >= AI_CONFIG.jobs.maxAttempts) {
                throw error // Let the caller handle final failure
            }

            // Wait before retrying
            await new Promise(resolve =>
                setTimeout(resolve, AI_CONFIG.jobs.retryDelayMs)
            )

            // Update attempt count
            await db.aIJob.update({
                where: { id: jobId },
                data: {
                    attempts,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
            })
        }
    }
}