import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicSeoPage, publicSeoStyles as styles } from '@/components/PublicSeoPage'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how Oklahoma SeamCast handles account credentials, catch logs, local browser storage, anonymous field telemetry, and self-service account deletion.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPolicyPage() {
  return (
    <PublicSeoPage
      category="Privacy"
      title="Privacy Policy"
      description="Effective October 30, 2026. This policy explains what information Oklahoma SeamCast collects, how it is used and protected, and how you can delete your account at any time."
    >
      <div className={styles.detail}>
        <section className={styles.detailSection}>
          <h2>1. Information we collect</h2>
          <ul>
            <li>
              <strong>Account information:</strong> When you create an account, Supabase Auth stores your email address, password hash, and optional profile fields (full name, username, and avatar URL).
            </li>
            <li>
              <strong>Fishing activity you save:</strong> Catches, trip journal entries, saved spots, private catch/trip photos, and community map pins or spot submissions are stored in your account with row-level security restricting private records to you.
            </li>
            <li>
              <strong>Location lookups:</strong> Browser or device geolocation is requested only when you explicitly enable nearby-water sorting or spot condition lookups. Public condition requests query weather and hydrology providers (NOAA NWS, USGS, Open-Meteo) using spot or viewport coordinates without sending your account identity.
            </li>
            <li>
              <strong>Anonymous performance metrics:</strong> Coarse Core Web Vitals (route path, mobile/desktop class, viewport width, and timing metrics) are recorded without IP addresses, user IDs, cookies, or query strings.
            </li>
          </ul>
        </section>

        <section className={styles.detailSection}>
          <h2>2. Cookies and local browser storage</h2>
          <p>
            Oklahoma SeamCast does not use third-party advertising trackers. We use strictly necessary cookies to maintain your Supabase authentication session when signed in, plus browser <code>localStorage</code>, <code>IndexedDB</code>, and a service worker cache so public fishing spots, unit preferences, and offline maps remain available when cell coverage drops at the water.
          </p>
        </section>

        <section className={styles.detailSection}>
          <h2>3. How we use and share data</h2>
          <p>
            We use your data solely to provide Oklahoma SeamCast features: syncing your logbook across devices, computing provider-reported fishing conditions, moderating community spot submissions, and keeping the service secure and reliable. Infrastructure providers include Vercel (hosting and aggregate analytics), Supabase (authentication, PostgreSQL database, and private object storage), and optional AI inference providers when you submit an AI prompt or fish photo for identification. We never sell personal data.
          </p>
        </section>

        <section className={styles.detailSection}>
          <h2>4. Data retention and self-service account deletion</h2>
          <p>
            You control your account data. Signed-in anglers can permanently delete their account and associated profile, catches, trip logs, saved spots, community pins, and uploaded photos at any time from{' '}
            <Link href="/account">Account Settings</Link>. Local offline caches stored in your browser can be cleared through your browser site settings.
          </p>
        </section>
      </div>
    </PublicSeoPage>
  )
}
