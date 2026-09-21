import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

/** Renders admin-route content without adding a DOM wrapper. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
