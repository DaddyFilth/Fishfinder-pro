import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PrivacyPolicyPage, { metadata as privacyMetadata } from './privacy/page'
import TermsOfUsePage, { metadata as termsMetadata } from './terms/page'

describe('public legal pages (/privacy and /terms)', () => {
  it('renders Privacy Policy with canonical metadata, storage disclosure, and deletion instructions', () => {
    expect(privacyMetadata.alternates?.canonical).toBe('/privacy')
    const html = renderToStaticMarkup(<PrivacyPolicyPage />)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('localStorage')
    expect(html).toContain('IndexedDB')
    expect(html).toContain('/account')
  })

  it('renders Terms of Use with canonical metadata and ODWC regulatory disclaimer', () => {
    expect(termsMetadata.alternates?.canonical).toBe('/terms')
    const html = renderToStaticMarkup(<TermsOfUsePage />)
    expect(html).toContain('Terms of Use')
    expect(html).toContain('Oklahoma Department of Wildlife Conservation')
    expect(html).toContain('/privacy')
  })
})
