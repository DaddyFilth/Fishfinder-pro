import { Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AccountLayout from './account/layout'
import AdminLayout from './admin/layout'
import AuthLayout from './auth/layout'

type Layout = (props: { children: ReactNode }) => ReactNode

const layouts: Array<[string, Layout]> = [
  ['account', AccountLayout],
  ['admin', AdminLayout],
  ['auth', AuthLayout],
]

describe.each(layouts)('%s layout', (_name, LayoutComponent) => {
  it('forwards a single child without adding wrapper markup', () => {
    const markup = renderToStaticMarkup(
      <LayoutComponent>
        <main data-testid="content">Page content</main>
      </LayoutComponent>,
    )

    expect(markup).toBe('<main data-testid="content">Page content</main>')
  })

  it('preserves sibling order without adding a fragment wrapper', () => {
    const markup = renderToStaticMarkup(
      <LayoutComponent>
        <header>Heading</header>
        <main>Content</main>
      </LayoutComponent>,
    )

    expect(markup).toBe('<header>Heading</header><main>Content</main>')
  })

  it('renders no markup when children are absent', () => {
    expect(renderToStaticMarkup(<LayoutComponent>{null}</LayoutComponent>)).toBe('')
  })

  it('returns a React fragment so multiple route children remain valid', () => {
    const result = LayoutComponent({ children: ['first', 'second'] })

    expect(result).toMatchObject({
      type: Fragment,
      props: { children: ['first', 'second'] },
    })
  })
})
