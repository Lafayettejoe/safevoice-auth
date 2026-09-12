import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

const protectedRoutes = ['/dashboard']
const authRoutes = ['/signin', '/signup', '/forgot-password']

export function middleware(request: NextRequest) {
    const token = request.cookies.get('session')?.value
    const pathname = request.nextUrl.pathname

    const isProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
    )

    const isAuthRoute = authRoutes.some(route =>
        pathname.startsWith(route)
    )

    // If trying to access protected route without session
    if (isProtectedRoute) {
        if (!token) {
            return NextResponse.redirect(new URL('/signin', request.url))
        }

        const payload = verifySessionToken(token)
        if (!payload) {
            return NextResponse.redirect(new URL('/signin', request.url))
        }
    }

    // If already signed in and trying to access auth pages
    if (isAuthRoute && token) {
        const payload = verifySessionToken(token)
        if (payload) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}