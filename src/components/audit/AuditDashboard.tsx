'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, CheckCircle2, CircleAlert, Code2, Database, Download, FileText, Gauge, Link2, Search, ShieldCheck } from 'lucide-react'

type EvidenceStatus = 'Available' | 'Pending'

type Source = {
  name: string
  status: EvidenceStatus
  coverage: string
  metrics: string
  nextStep: string
  icon: typeof Search
}

const sources: Source[] = [
  { name: 'Google Search Console', status: 'Pending', coverage: '0 rows loaded', metrics: 'Queries, pages, clicks, impressions, CTR, position, index coverage', nextStep: 'Upload the GSC performance and index coverage exports.', icon: Search },
  { name: 'GA4', status: 'Pending', coverage: '0 rows loaded', metrics: 'Sessions, engagement and conversions by landing page and channel', nextStep: 'Upload the GA4 landing page × channel export.', icon: BarChart3 },
  { name: 'Performance field data', status: 'Available', coverage: 'Instrumented; 0 field rows in repo', metrics: 'LCP, INP, CLS by route', nextStep: 'Connect a Speed Insights or PageSpeed/CrUX export before scoring.', icon: Gauge },
  { name: 'Backlinks', status: 'Pending', coverage: '0 rows loaded', metrics: 'Referring domains, anchors, new and lost links', nextStep: 'Upload an Ahrefs, Semrush or DataForSEO export.', icon: Link2 },
]

const routes = [
  { route: '/', type: 'Primary app', evidence: 'Repository route', status: 'Tracked by Speed Insights component' },
  { route: '/locations', type: 'Indexable page', evidence: 'Repository route', status: 'No field sample available' },
  { route: '/species', type: 'Indexable page', evidence: 'Repository route', status: 'No field sample available' },
  { route: '/locations/[slug]', type: 'Dynamic page', evidence: 'Repository route', status: 'No field sample available' },
  { route: '/species/[slug]', type: 'Dynamic page', evidence: 'Repository route', status: 'No field sample available' },
]

const codeChanges = [
  { title: 'Added an auditable evidence surface', detail: 'This dashboard labels every metric with its source and availability instead of filling gaps with estimates.', icon: ShieldCheck },
  { title: 'Preserved field performance instrumentation', detail: 'The root layout already includes @vercel/speed-insights/next; route-level field data is still required to quantify CWV.', icon: Gauge },
  { title: 'Made data readiness explicit', detail: 'Pending exports are isolated from findings, so unavailable acquisition data cannot be mistaken for zero performance.', icon: Database },
]

function StatusPill({ status }: { status: EvidenceStatus }) {
  return <span className={`status-pill ${status === 'Available' ? 'status-pill--good' : 'status-pill--pending'}`}><span aria-hidden="true">{status === 'Available' ? '●' : '○'}</span>{status}</span>
}

export default function AuditDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'changes'>('overview')
  const availableCount = useMemo(() => sources.filter((source) => source.status === 'Available').length, [])

  return (
    <main className="audit-shell">
      <header className="audit-header">
        <div className="audit-brand"><span className="audit-mark"><FileText size={18} /></span><div><p className="eyebrow">SEAMCAST / SEO & PRODUCT AUDIT</p><h1>Evidence ledger</h1></div></div>
        <div className="header-actions"><span className="date-chip">Snapshot · 07 Oct 2026</span><button className="icon-button" aria-label="Export audit"><Download size={17} /></button></div>
      </header>

      <div className="audit-body">
        <aside className="audit-sidebar" aria-label="Audit navigation">
          <div className="sidebar-intro"><span className="live-dot" />Evidence-first review<p>Only observed values make it into findings.</p></div>
          <nav className="audit-nav">
            {([['overview', 'Overview'], ['sources', 'Source coverage'], ['changes', 'Code changes']] as const).map(([id, label]) => <button key={id} className={activeTab === id ? 'nav-item nav-item--active' : 'nav-item'} onClick={() => setActiveTab(id)}>{label}<ArrowUpRight size={14} /></button>)}
          </nav>
          <div className="sidebar-foot"><Code2 size={15} /><span>Repository evidence<br /><strong>Fishfinder-pro / main</strong></span></div>
        </aside>

        <section className="audit-content">
          <div className="content-heading"><div><p className="eyebrow">AUDIT STATUS</p><h2>{activeTab === 'overview' ? 'A quantified baseline without invented numbers' : activeTab === 'sources' ? 'Evidence source coverage' : 'Changes made for compatibility'}</h2><p className="lede">The required exports are not present in this checkout. The dashboard is ready for them and keeps unavailable metrics unscored.</p></div><StatusPill status={availableCount > 0 ? 'Available' : 'Pending'} /></div>

          {activeTab === 'overview' && <>
            <div className="metric-grid">
              <article className="metric-card"><span>Sources connected</span><strong>{availableCount} <small>/ 4</small></strong><em>1 instrumented, 3 pending</em></article>
              <article className="metric-card"><span>Export rows</span><strong>0</strong><em>No source files detected</em></article>
              <article className="metric-card"><span>Routes inventoried</span><strong>{routes.length}</strong><em>Repository route evidence</em></article>
              <article className="metric-card metric-card--accent"><span>Evidence confidence</span><strong>Scoped</strong><em>Acquisition required for scoring</em></article>
            </div>
            <div className="panel-grid"><section className="panel"><div className="panel-title"><div><p className="eyebrow">READINESS MATRIX</p><h3>Required inputs</h3></div><Database size={18} /></div><div className="source-list">{sources.map((source) => { const Icon = source.icon; return <div className="source-row" key={source.name}><span className="source-icon"><Icon size={16} /></span><div className="source-copy"><strong>{source.name}</strong><span>{source.coverage}</span></div><StatusPill status={source.status} /></div> })}</div></section><section className="panel finding-panel"><div className="panel-title"><div><p className="eyebrow">FINDINGS</p><h3>What the evidence supports</h3></div><CircleAlert size={18} /></div><div className="finding"><span className="finding-number">01</span><div><strong>Instrumentation is present</strong><p>Repository evidence confirms Speed Insights is mounted in the root layout. No LCP, INP or CLS values were available to assess.</p></div></div><div className="finding"><span className="finding-number">02</span><div><strong>Acquisition is the blocker</strong><p>Search, analytics and backlink findings remain unscored because no exports were found in the checkout.</p></div></div></section></div>
            <section className="panel"><div className="panel-title"><div><p className="eyebrow">ROUTE INVENTORY</p><h3>Performance measurement targets</h3></div><Gauge size={18} /></div><div className="table-wrap"><table><thead><tr><th>Route</th><th>Type</th><th>Evidence</th><th>Current state</th></tr></thead><tbody>{routes.map((route) => <tr key={route.route}><td><code>{route.route}</code></td><td>{route.type}</td><td>{route.evidence}</td><td><span className="table-muted">{route.status}</span></td></tr>)}</tbody></table></div></section>
          </>}

          {activeTab === 'sources' && <section className="panel source-detail-grid">{sources.map((source) => { const Icon = source.icon; return <article className="source-card" key={source.name}><div className="source-card-heading"><span className="source-icon"><Icon size={18} /></span><StatusPill status={source.status} /></div><h3>{source.name}</h3><p>{source.metrics}</p><div className="source-card-foot"><span>{source.coverage}</span><small>{source.nextStep}</small></div></article> })}</section>}

          {activeTab === 'changes' && <section className="panel changes-list">{codeChanges.map((change) => { const Icon = change.icon; return <article className="change-row" key={change.title}><span className="change-icon"><Icon size={17} /></span><div><h3>{change.title}</h3><p>{change.detail}</p></div><CheckCircle2 size={17} className="change-check" /></article> })}<div className="method-note"><strong>Method note</strong><p>Once exports arrive, tables and charts should be calculated from their rows, retaining the file name, date range, dimensions and metric definitions alongside every finding.</p></div></section>}
        </section>
      </div>
    </main>
  )
}
