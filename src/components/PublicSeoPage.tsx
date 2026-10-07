import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './PublicSeoPage.module.css'

export function PublicSeoPage({
  category,
  title,
  description,
  children,
}: {
  category: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/">Oklahoma SeamCast</Link>
          <span aria-hidden="true">/</span>
          <span>{category}</span>
        </nav>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Oklahoma SeamCast guide</p>
          <h1>{title}</h1>
          <p className={styles.intro}>{description}</p>
        </header>
        {children}
        <footer className={styles.footer}>
          <p>
            Catalog content is informational and is not a live observation or
            confirmation of current access, conditions, or regulations.
          </p>
          <Link href="/">Explore the fishing map</Link>
        </footer>
      </div>
    </main>
  )
}

export { styles as publicSeoStyles }
