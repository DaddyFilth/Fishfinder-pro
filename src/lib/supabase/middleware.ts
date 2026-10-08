import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requireSupabasePublicConfig } from './config'

type ClaimsResult = Awaited<ReturnType<ReturnType<typeof createServerClient>['auth']['getClaims']>>

export type SessionUpdate = {
  /** Response to hand back to the caller, carrying any refreshed auth cookies. */
  response: NextResponse
  /** Verified Supabase claims, or `null` when the visitor has no valid session. */
  user: Extract<ClaimsResult, { data: { claims: unknown } }>['data']['claims'] | null
}

/**
 * Verifies the Supabase session for a proxied request and returns the response that must be
 * forwarded upstream (carrying any rotated auth cookies) plus the resolved claims.
 *
 * Redirecting is deliberately left to the caller: only the proxy knows how to preserve the
 * `next` parameter and how to distinguish API routes from pages.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let supabaseResponse = NextResponse.next({
    request,
  })
  const config = requireSupabasePublicConfig()

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    config.url,
    config.key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return { response: supabaseResponse, user }
}