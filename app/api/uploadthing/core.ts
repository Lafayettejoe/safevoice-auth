import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { getCurrentUser } from '@/lib/auth'
import { cookies } from 'next/headers'

const f = createUploadthing()

export const ourFileRouter = {
    audioUploader: f({
        audio: {
            maxFileSize: '25MB',
            maxFileCount: 1,
        },
    })
        .middleware(async () => {
            const cookieStore = await cookies()
            const token = cookieStore.get('session')?.value

            if (!token) {
                throw new Error('Unauthorized — no session token')
            }

            // Retry database connection up to 3 times
            let user = null
            let lastError = null

            for (let i = 0; i < 3; i++) {
                try {
                    user = await getCurrentUser(token)
                    break
                } catch (error) {
                    lastError = error
                    console.error(`DB attempt ${i + 1} failed:`, error)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                }
            }

            if (!user) {
                console.error('All DB attempts failed:', lastError)
                throw new Error('Database connection failed — please try again')
            }

            return { userId: user.id }
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log('Upload complete:', file.name, 'for user:', metadata.userId)
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