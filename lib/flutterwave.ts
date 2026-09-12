const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY!
const FLW_BASE_URL = 'https://api.flutterwave.com/v3'

interface InitiatePaymentParams {
    txRef: string
    amount: number
    currency: string
    customerEmail: string
    customerName: string
    redirectUrl: string
    meta?: Record<string, string>
}

interface FlutterwaveResponse {
    status: string
    message: string
    data: {
        link?: string
        id?: number
        tx_ref?: string
        amount?: number
        currency?: string
        charged_amount?: number
        status?: string
    }
}

export async function initiatePayment(params: InitiatePaymentParams): Promise<string> {
    const response = await fetch(`${FLW_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${FLW_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            tx_ref: params.txRef,
            amount: params.amount / 100,
            currency: params.currency,
            redirect_url: params.redirectUrl,
            customer: {
                email: params.customerEmail,
                name: params.customerName,
            },
            meta: params.meta,
            customizations: {
                title: 'SafeVoice',
                description: 'SafeVoice Camp License Subscription',
                logo: 'https://your-logo-url.com/logo.png',
            },
        }),
    })

    const data: FlutterwaveResponse = await response.json()

    if (data.status !== 'success' || !data.data.link) {
        throw new Error(`Flutterwave initiation failed: ${data.message}`)
    }

    return data.data.link
}

export async function verifyTransaction(transactionId: string): Promise<{
    status: string
    amount: number
    currency: string
    txRef: string
}> {
    const response = await fetch(
        `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${FLW_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    )

    const data: FlutterwaveResponse = await response.json()

    if (data.status !== 'success') {
        throw new Error(`Flutterwave verification failed: ${data.message}`)
    }

    return {
        status: data.data.status || 'failed',
        amount: (data.data.charged_amount || 0) * 100,
        currency: data.data.currency || 'NGN',
        txRef: data.data.tx_ref || '',
    }
}

export function verifyWebhookSignature(signature: string): boolean {
    return signature === process.env.FLW_WEBHOOK_HASH
}