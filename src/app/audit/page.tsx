import type { Metadata } from 'next'
import AuditDashboard from '@/components/audit/AuditDashboard'
import './audit.css'

export const metadata: Metadata = {
  title: 'Evidence Audit',
  description: 'Evidence-first SEO, analytics, performance and backlink audit workspace for Oklahoma SeamCast.',
  robots: { index: false, follow: false },
}

export default function AuditPage() {
  return <AuditDashboard />
}
