import { NextRequest, NextResponse } from 'next/server'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function canonicalOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost ?? request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/') && UNSAFE_METHODS.has(request.method)) {
    const fetchSite = request.headers.get('sec-fetch-site')
    if (fetchSite === 'cross-site') {
      return NextResponse.json({ ok: false, error: 'Anfrage aus fremdem Ursprung abgelehnt.' }, { status: 403 })
    }

    const origin = request.headers.get('origin')
    if (origin && origin !== canonicalOrigin(request)) {
      return NextResponse.json({ ok: false, error: 'Ungültiger Anfrageursprung.' }, { status: 403 })
    }
  }

  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons/|brand/|legal/).*)'],
}
