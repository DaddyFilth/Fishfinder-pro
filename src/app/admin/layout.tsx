import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

/** Renders administration route content without introducing an additional DOM element. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
