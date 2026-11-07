import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Terms governing use of Oklahoma SeamCast, including safety, access verification, Oklahoma fishing regulation responsibilities, and community conduct.',
  alternates: { canonical: '/terms' },
}

export default function TermsOfUsePage() {
  return (
    <PublicSeoPage
      category="Terms"
      title="Terms of Use"
      description="Effective October 30, 2026. By accessing or using Oklahoma SeamCast, you agree to these terms."
    >
      <div className={styles.detail}>
        <section className={styles.detailSection}>
          <h2>1. Planning aid — not official navigation or regulatory notice</h2>
          <p>
            Oklahoma SeamCast compiles bundled public-water catalog entries, third-party weather and water-data feeds (such as NOAA NWS, USGS, and Open-Meteo), bathymetry references, and optional AI summaries. None of this content guarantees current legal access, safe water or weather conditions, water depth, navigation clearance, or fish presence. Always verify Oklahoma Department of Wildlife Conservation (ODWC), USACE, municipal, and tribal fishing licenses, slot/creel limits, closures, and posted signage before traveling or launching.
          </p>
        </section>

        <section className={styles.detailSection}>
          <h2>2. Field safety and assumption of risk</h2>
          <p>
            Fishing, wading, kayaking, and boating carry inherent weather, hydrological, and terrain hazards. Do not rely on Oklahoma SeamCast for emergency weather alerts, dam release schedules, or marine navigation. You assume full responsibility for your safety and compliance with all local, state, and federal laws.
          </p>
        </section>

        <section className={styles.detailSection}>
          <h2>3. Accounts and community contributions</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>Community pins and spot submissions must describe genuine public-access waters only—never private property without lawful public fishing access.</li>
            <li>Do not upload unlawful, abusive, or deceptive content, or attempt to bypass rate limits, authentication, or access controls.</li>
          </ul>
        </section>

        <section className={styles.detailSection}>
          <h2>4. Account termination and Warranties</h2>
          <p>
            Oklahoma SeamCast is provided &ldquo;as is&rdquo; without warranties of any kind. You may delete your account at any time in{' '}
            <Link href="/account">Account Settings</Link>, and we may suspend accounts that abuse the service or violate these terms. See our{' '}
            <Link href="/privacy">Privacy Policy</Link> for details on how data and browser storage are handled.
          </p>
        </section>
      </div>
    </PublicSeoPage>
  )
}
