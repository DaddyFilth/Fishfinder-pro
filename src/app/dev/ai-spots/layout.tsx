import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Provider Feed Development View',
  robots: {
    index: false,
    follow: false,
  },
}

export default function DevAiSpotsLayout({ children }: { children: React.ReactNode }) {
  return children
}
