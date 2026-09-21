import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AccountLayout from './account/layout'
import AdminLayout from './admin/layout'
import AuthLayout from './auth/layout'

const privateLayouts = [
  ['account', AccountLayout],
  ['admin', AdminLayout],
  ['auth', AuthLayout],
] as const

describe.each(privateLayouts)('%s layout', (_name, Layout) => {
  it('renders its child without adding wrapper markup', () => {
    const markup = renderToStaticMarkup(
      <Layout>
        <main data-private-content="true">Private content</main>
      </Layout>,
    )

    expect(markup).toBe('<main data-private-content="true">Private content</main>')
  })

  it('preserves multiple sibling children without adding a container', () => {
    const markup = renderToStaticMarkup(
      <Layout>
        <h1>Heading</h1>
        <p>Details</p>
      </Layout>,
    )

    expect(markup).toBe('<h1>Heading</h1><p>Details</p>')
  })

  it('renders no markup when its child is empty', () => {
    expect(renderToStaticMarkup(<Layout>{null}</Layout>)).toBe('')
  })
})
