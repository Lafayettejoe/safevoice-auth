import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'
import { AI_CONFIG } from '@/lib/ai/config'

const f = createUploadthing()

export const ourFileRouter = {
    audioUploader: f({
        blob: {
            maxFileSize: '25MB',
            maxFileCount: 1,
        },
    })
        .middleware(async () => {
            const cookieStore = await cookies()
            const token = cookieStore.get('session')?.value
            const user = await getCurrentUser(token)

            if (!user) throw new Error('Unauthorized')

            return { userId: user.id }
        })
        .onUploadComplete(async ({ metadata, file }) => {
            return {
                userId: metadata.userId,
                fileKey: file.key,
                fileUrl: file.ufsUrl,
                fileName: file.name,
                fileSize: file.size,
            }
        }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter