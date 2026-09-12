import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const signInRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'safevoice:signin',
})

export const signUpRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '60 m'),
    prefix: 'safevoice:signup',
})

export const forgotPasswordRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '60 m'),
    prefix: 'safevoice:forgot',
})

export const resendCodeRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '60 m'),
    prefix: 'safevoice:resend',
})