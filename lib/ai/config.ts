export const AI_CONFIG = {
    // Transcription
    transcription: {
        model: 'whisper-1',
        timeoutMs: 30000,
        maxFileSizeMb: 25,
        supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
    },

    // Classification
    classification: {
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 256,
        timeoutMs: 30000,
    },

    // Job processing
    jobs: {
        maxAttempts: 3,
        retryDelayMs: 5000,
    },

    // Rate limiting
    rateLimit: {
        uploadsPerHour: 10,
        followupPerMinute: 5,
    },
} as const