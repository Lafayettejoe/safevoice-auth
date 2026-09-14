import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/dashboard', '/billing', '/records', '/upload', '/results']
const authRoutes = ['/signin', '/signup', '/forgot-password', '/verify', '/reset-password']

export function proxy(request: NextRequest) {
    const token = request.cookies.get('session')?.value
    const pathname = request.nextUrl.pathname

    const isProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
    )
    const isAuthRoute = authRoutes.some(route =>
        pathname.startsWith(route)
    )

    if (isProtectedRoute && !token) {
        return NextResponse.redirect(new URL('/signin', request.url))
    }

    if (isAuthRoute && token) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}