import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from './db'

const JWT_SECRET = process.env.JWT_SECRET!

// Password hashing
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
}

export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
}

// Session token
export function createSessionToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifySessionToken(token: string): { userId: string } | null {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string }
        return payload
    } catch {
        return null
    }
}

// Get current user from token
export async function getCurrentUser(token: string | undefined) {
    if (!token) return null

    const payload = verifySessionToken(token)
    if (!payload) return null

    const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
        },
    })

    return user
}