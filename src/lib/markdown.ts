const BOLD = /\*\*(.+?)\*\*/g
const STRIKETHROUGH = /~~(.+?)~~/g

interface RenderBlock {
  type: 'p' | 'ul' | 'ol'
  lines: string[]
}

/**
 * Trims whitespace AND markdown formatting characters for search matching.
 * Strips **, ~~, -, 1., etc so "**hello**" matches search "hello".
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/^[\s]*[-*]\s/gm, '')
    .replace(/^[\s]*\d+\.\s/gm, '')
    .trim()
}

function renderInline(text: string): string {
  return text
    .replace(BOLD, '<strong class="font-bold">$1</strong>')
    .replace(STRIKETHROUGH, '<del class="line-through opacity-60">$1</del>')
}

function renderBlock(block: RenderBlock): string {
  if (block.type === 'ul') {
    const items = block.lines
      .map((l) => l.replace(/^[\s]*[-*]\s/, ''))
      .map((l) => `<li>${renderInline(l)}</li>`)
      .join('')
    return `<ul class="list-disc pl-4 space-y-0.5">${items}</ul>`
  }
  if (block.type === 'ol') {
    const items = block.lines
      .map((l) => l.replace(/^[\s]*\d+\.\s/, ''))
      .map((l) => `<li>${renderInline(l)}</li>`)
      .join('')
    return `<ol class="list-decimal pl-4 space-y-0.5">${items}</ol>`
  }
  // paragraph
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
