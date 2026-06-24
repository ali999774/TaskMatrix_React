// SECURITY INVARIANT: escape-first is sufficient ONLY because every emitted tag is attribute-free and URL-free. Adding link/image syntax (<a>, <img>) requires URL-scheme validation (block javascript:), not just text escaping.
const BOLD = /\*\*(.+?)\*\*/g
const STRIKETHROUGH = /~~(.+?)~~/g

interface RenderBlock {
  type: 'p' | 'ul' | 'ol'
  lines: string[]
}

/** Strip markdown formatting for search matching. */
export function stripMarkdown(text: string): string {
  return text
    .replace(BOLD, '$1')
    .replace(STRIKETHROUGH, '$1')
    .replace(/^[\s]*[-*]\s/gm, '')
    .replace(/^[\s]*\d+\.\s/gm, '')
    .trim()
}

// Escape HTML before formatting so note text can't inject markup via
// dangerouslySetInnerHTML, and so literal <, >, & render correctly.
// Only touches &<> — leaves ** and ~~ intact for the substitutions below.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(BOLD, '<strong>$1</strong>')
    .replace(STRIKETHROUGH, '<del>$1</del>')
}

function renderBlock(block: RenderBlock): string {
  if (block.type === 'ul') {
    const items = block.lines
      .map((l) => l.replace(/^[\s]*[-*]\s/, ''))
      .map((l) => `<li>${renderInline(l)}</li>`)
      .join('')
    return `<ul style="list-style-type:disc;list-style-position:inside;padding-left:1rem">${items}</ul>`
  }
  if (block.type === 'ol') {
    const items = block.lines
      .map((l) => l.replace(/^[\s]*\d+\.\s/, ''))
      .map((l) => `<li style="display:list-item">${renderInline(l)}</li>`)
      .join('')
    return `<ol style="list-style-type:decimal;list-style-position:inside;padding-left:1rem">${items}</ol>`
  }
  return `<p>${renderInline(block.lines[0])}</p>`
}

export function renderMarkdown(text: string): string {
  if (!text) return ''
  const lines = text.split('\n')
  const blocks: RenderBlock[] = []
  let current: RenderBlock | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      current = null
      continue
    }
    const isUl = /^[\s]*[-*]\s/.test(trimmed)
    const isOl = /^[\s]*\d+\.\s/.test(trimmed)

    if (isUl) {
      if (!current || current.type !== 'ul') {
        current = { type: 'ul', lines: [] }
        blocks.push(current)
      }
      current.lines.push(line)
    } else if (isOl) {
      if (!current || current.type !== 'ol') {
        current = { type: 'ol', lines: [] }
        blocks.push(current)
      }
      current.lines.push(line)
    } else {
      current = { type: 'p', lines: [line] }
      blocks.push(current)
    }
  }

  return blocks.map(renderBlock).join('')
}
