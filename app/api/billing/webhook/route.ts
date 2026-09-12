import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyWebhookSignature } from '@/lib/flutterwave'

export async function POST(request: NextRequest) {
    try {
        // Verify webhook signature
        const signature = request.headers.get('verif-hash') || ''
        if (!verifyWebhookSignature(signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const body = await request.json()
        const { event, data } = body

        if (event === 'charge.completed' && data.status === 'successful') {
            const transactionId = String(data.id)

            // Idempotency check — only process once
            const existingLog = await db.paymentLog.findFirst({
                where: {
                    providerReference: transactionId,
                    stage: 'FULFILLED',
                },
            })

            if (existingLog) {
                return NextResponse.json({ message: 'Already processed' })
            }

            // Log the webhook event
            await db.paymentLog.create({
                data: {
                    userId: data.meta?.userId || 'webhook',
                    stage: 'VERIFIED',
                    amount: data.amount * 100,
                    currency: data.currency,
                    providerReference: transactionId,
                    metadata: {
                        source: 'webhook',
                        event,
                        txRef: data.tx_ref,
                    },
                },
            })
        }

        return NextResponse.json({ message: 'Webhook received' })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}