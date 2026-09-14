import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import OpenAI from 'openai'
import { AI_CONFIG } from '@/lib/ai/config'
import { z } from 'zod'

const followupSchema = z.object({
    jobId: z.string().min(1),
    action: z.enum(['summarise', 'expand', 'suggest']),
})

const FOLLOWUP_PROMPTS = {
    summarise: 'Summarise this GBV report transcript in 2 to 3 clear sentences for a case worker. Focus on the key facts: what happened, when, and any immediate safety concerns.',
    expand: 'Expand on the risk assessment for this report. What additional information should the case worker gather? What contextual factors are most important?',
    suggest: 'Based on this report, suggest the most appropriate referral services and immediate next steps for the case worker to take.',
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('session')?.value
        const user = await getCurrentUser(token)

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = followupSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message },
                { status: 422 }
            )
        }

        const { jobId, action } = parsed.data

        const job = await db.aIJob.findFirst({
            where: { id: jobId, userId: user.id },
        })

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        if (job.status !== 'COMPLETE' || !job.transcriptText) {
            return NextResponse.json(
                { error: 'Job is not complete yet' },
                { status: 400 }
            )
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const response = await openai.chat.completions.create({
            model: AI_CONFIG.classification.model,
            temperature: 0.3,
            max_tokens: 512,
            messages: [
                {
                    role: 'system',
                    content: FOLLOWUP_PROMPTS[action],
                },
                {
                    role: 'user',
                    content: `Transcript:\n${job.transcriptText}\n\nRisk Level: ${job.riskLevel}`,
                },
            ],
        })

        const result = response.choices[0]?.message?.content ?? ''

        return NextResponse.json({ result, action })

    } catch (error) {
        console.error('Followup route error:', error)
        return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
}