import OpenAI from 'openai'
import { AI_CONFIG } from './config'

const SYSTEM_PROMPT = `You are a risk classification assistant for SafeVoice, a gender-based violence reporting system for women in Nigerian IDP camps.

You will receive a transcript of a voice report. Classify the risk level as HIGH, MEDIUM, or LOW based on these criteria:

HIGH: Ongoing threat, perpetrator has current access to survivor, report involves a minor under 15, sexual violence with physical injury, survivor indicates immediate danger.

MEDIUM: Incident within 7 days, perpetrator is known to the survivor, sexual violence without immediate ongoing threat.

LOW: Incident more than 7 days ago, perpetrator unknown or not in the camp, economic or emotional abuse without physical threat.

CRITICAL RULE: Do not treat the survivor's relationship to the perpetrator (spouse, family member, employer, or any other relationship) as a factor that reduces the risk level. The relationship does not make violence less serious.

You must respond with ONLY a valid JSON object in this exact format and nothing else:
{"riskLevel":"HIGH"|"MEDIUM"|"LOW","rationale":"brief explanation","suggestedActions":["action1","action2"]}`

interface ClassificationResult {
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
    rationale: string
    suggestedActions: string[]
}

export async function classifyTranscript(
    transcript: string
): Promise<ClassificationResult> {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })

    const classificationPromise = openai.chat.completions.create({
        model: AI_CONFIG.classification.model,
        temperature: AI_CONFIG.classification.temperature,
        max_tokens: AI_CONFIG.classification.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `Please classify the risk level of this report transcript:\n\n${transcript}`,
            },
        ],
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
            () => reject(new Error('Classification timed out after 30 seconds')),
            AI_CONFIG.classification.timeoutMs
        )
    )

    const response = await Promise.race([classificationPromise, timeoutPromise])

    const raw = response.choices[0]?.message?.content ?? ''

    let parsed: ClassificationResult
    try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(cleaned)
    } catch {
        throw new Error(`Classification returned invalid JSON: ${raw}`)
    }

    if (!['HIGH', 'MEDIUM', 'LOW'].includes(parsed.riskLevel)) {
        throw new Error(`Invalid risk level: ${parsed.riskLevel}`)
    }

    return parsed
}