export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  )
}

export function highlight(text: string, query: string): string {
  const safe = escapeHtml(text || '')
  if (!query) return safe
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return safe.replace(re, m => `<mark>${m}</mark>`)
}

// 自定义 Markdown 渲染（匹配原版 renderMd 逻辑）
export function renderMd(text: string | null): string {
  if (!text) return ''
  const lines = text.split('\n')
  let html = ''
  let inList = false
  let inSection = false

  function fmtLine(s: string): string {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (inList) { html += '</ul>'; inList = false }
      if (inSection) { html += '</p>'; inSection = false }
      continue
    }

    // 章节标签：**【考点】** / **【选项分析】** / **【知识拓展】**
    const labelRe = /^\*\*(【.+?】)\*\*(.*)$/
    const labelMatch = line.match(labelRe)
    if (labelMatch) {
      if (inList) { html += '</ul>'; inList = false }
      if (inSection) { html += '</p>'; inSection = false }
      const label = labelMatch[1]
      const rest = labelMatch[2].trim()
      html += `<p class="expl-section"><span class="expl-section-label">${label}</span> `
      if (rest) html += fmtLine(rest) + '<br>'
      inSection = true
      continue
    }

    if (inSection) {
      if (line.startsWith('- ')) {
        html += '</p>'
        inSection = false
      } else {
        html += fmtLine(line) + '<br>'
        continue
      }
    }

    // 列表项
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul class="expl-list">'; inList = true }
      const content = line.slice(2)
      const checkMatch = content.match(/^(\s*)([✓✗])\s*\*\*(.+?)\*\*\s*(.*)$/)
      if (checkMatch) {
        const mark = checkMatch[2]
        const key = checkMatch[3]
        const rest = checkMatch[4]
        const cls = mark === '✓' ? 'opt-correct' : 'opt-wrong'
        html += `<li class="${cls}"><span class="opt-mark">${mark}</span><span class="opt-key">${escapeHtml(key)}</span> ${escapeHtml(rest)}</li>`
      } else {
        html += `<li>${fmtLine(content)}</li>`
      }
      continue
    }

    if (inList) { html += '</ul>'; inList = false }
    html += `<p>${fmtLine(line)}</p>`
  }
  if (inList) html += '</ul>'
  if (inSection) html += '</p>'
  return html
}
