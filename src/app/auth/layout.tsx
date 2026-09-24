import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

/** Renders authentication route content without introducing an additional DOM element. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
