import OpenAI from 'openai'
import { AI_CONFIG } from './config'

export async function transcribeAudio(
    fileUrl: string,
    fileName: string
): Promise<{ transcript: string; durationMs: number }> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const startTime = Date.now()

    // Fetch the file from UploadThing URL
    const fileResponse = await fetch(fileUrl)
    if (!fileResponse.ok) {
        throw new Error(`Failed to fetch audio file: ${fileResponse.statusText}`)
    }

    const fileBuffer = await fileResponse.arrayBuffer()
    const file = new File([fileBuffer], fileName, { type: 'audio/webm' })

    // Call Whisper with a timeout
    const transcriptionPromise = openai.audio.transcriptions.create({
        file,
        model: AI_CONFIG.transcription.model,
        response_format: 'text',
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
            () => reject(new Error('Transcription timed out after 30 seconds')),
            AI_CONFIG.transcription.timeoutMs
        )
    )

    const transcript = await Promise.race([transcriptionPromise, timeoutPromise])

    return {
        transcript: String(transcript),
        durationMs: Date.now() - startTime,
    }
}