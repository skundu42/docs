import { Parser } from 'acorn'
import acornJsx from 'acorn-jsx'
import { Serializer } from 'serialize-as-code'
import { visit } from 'unist-util-visit'
import { slugifyWithCounter } from '@sindresorhus/slugify'
import { merge } from 'lodash-es'
import process from 'process'
import path from 'path'

const JSXParser = Parser.extend(acornJsx())

const getAstToInject = function (locale, outline) {
  return {
    type: 'mdxjsEsm',
    value: '',
    data: {
      estree: JSXParser.parse(
        `
        import { MDXLayout as _MDXLayout } from '@/layout/MDXLayout'
        import { getNavItems } from '@/navigation'

        export async function getStaticProps() {
          const navItems = await getNavItems('${locale}')
          const outline = ${Serializer.run(outline)}

          return {
            props: {
              navItems,
              outline,
            },
          }
        }

        export default function ({ navItems, outline, children }) {
          return (
            <_MDXLayout
              navItems={navItems}
              frontmatter={typeof frontmatter !== 'undefined' ? frontmatter : undefined}
              outline={outline}
            >
              {children}
            </_MDXLayout>
          )
        }
      `,
        {
          sourceType: 'module',
          ecmaVersion: '2020',
        }
      ),
    },
  }
}

/** @type {import('unified').Plugin<[], import('mdast').Root>} */
export const remarkMdxLayout = () => {
  return (ast, file) => {
    const slugify = slugifyWithCounter()
    const outline = []

    visit(ast, 'heading', (heading) => {
      let headingText = ''

      visit(heading, 'text', (textNode) => {
        headingText = `${headingText}${textNode.value}`
      })

      const headingId = slugify(headingText)

      heading.data = merge(heading.data, {
        hProperties: {
          id: headingId,
        },
      })

      outline.push({
        id: headingId,
        title: headingText,
        level: heading.depth,
      })
    })

    const relativePath = path.relative(path.join(process.cwd(), 'pages'), file.path)
    const locale = relativePath.substring(0, 2)
    const astToInject = getAstToInject(locale, outline)

    ast.children.push(astToInject)
  }
}
