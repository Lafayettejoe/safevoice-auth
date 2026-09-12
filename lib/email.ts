import { Resend } from 'resend'

export async function sendVerificationEmail(
    email: string,
    code: string
) {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject: 'Verify your SafeVoice email address',
        html: `
      <h2>Welcome to SafeVoice</h2>
      <p>Your verification code is:</p>
      <h1 style="font-size: 48px; letter-spacing: 8px; color: #0A4D2A;">${code}</h1>
      <p>This code expires in 15 minutes.</p>
      <p>If you did not create an account, ignore this email.</p>
    `,
    })
}

export async function sendPasswordResetEmail(
    email: string,
    resetUrl: string
) {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: email,
        subject: 'Reset your SafeVoice password',
        html: `
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background: #0A4D2A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a>
      <p>This link expires in 1 hour and can only be used once.</p>
      <p>If you did not request a password reset, ignore this email.</p>
    `,
    })
}

export function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}