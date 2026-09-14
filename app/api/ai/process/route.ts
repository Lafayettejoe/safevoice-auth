import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { classifyTranscript } from '@/lib/ai/classify'
import { AI_CONFIG } from '@/lib/ai/config'
import { cookies } from 'next/headers'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const fileName = formData.get('fileName') as string
        const fileSize = parseInt(formData.get('fileSize') as string)

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (file.size > AI_CONFIG.transcription.maxFileSizeMb * 1024 * 1024) {
            return NextResponse.json(
                { error: `File must be under ${AI_CONFIG.transcription.maxFileSizeMb}MB` },
                { status: 400 }
            )
        }

        // Create job record
        const job = await db.aIJob.create({
            data: {
                userId: user.id,
                fileKey: `direct-upload-${Date.now()}`,
                fileName: fileName || file.name,
                fileSize: fileSize || file.size,
                status: 'PROCESSING',
                attempts: 1,
            },
        })

        // Process in background
        processJob(job.id, file, fileName || file.name).catch(async (error) => {
            console.error('Job failed:', error)
            await db.aIJob.update({
                where: { id: job.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Processing failed',
                },
            })
        })

        return NextResponse.json({
            jobId: job.id,
            message: 'Processing started',
        })

    } catch (error) {
        console.error('Process error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}

async function processJob(jobId: string, file: File, fileName: string) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Step 1: Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: AI_CONFIG.transcription.model,
        response_format: 'text',
    })

    const transcript = String(transcription)

    if (!transcript || transcript.trim().length === 0) {
        throw new Error('Transcription returned empty result')
    }

    // Step 2: Classify with GPT-4o-mini
    const classification = await classifyTranscript(transcript)

    // Step 3: Update job as complete
    await db.aIJob.update({
        where: { id: jobId },
        data: {
            status: 'COMPLETE',
            transcriptText: transcript,
            riskLevel: classification.riskLevel,
            riskRationale: JSON.stringify({
                rationale: classification.rationale,
                suggestedActions: classification.suggestedActions,
            }),
        },
    })
}