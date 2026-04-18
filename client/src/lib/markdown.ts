function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(value: string): string {
  const withInlineCode = value.replace(/`([^`]+)`/g, '<code>$1</code>');
  const withBold = withInlineCode.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return withItalic.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

export function renderMarkdown(input: string): string {
  const raw = String(input || '');
  const lines = raw.split(/\r\n|\n|\r/);
  const chunks: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        chunks.push('</ul>');
        inList = false;
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (inList) {
        chunks.push('</ul>');
        inList = false;
      }
      const level = headingMatch[1].length;
      const content = formatInline(escapeHtml(headingMatch[2]));
      chunks.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        chunks.push('<ul class="list-disc pl-5">');
        inList = true;
      }
      const content = formatInline(escapeHtml(listMatch[1]));
      chunks.push(`<li>${content}</li>`);
      continue;
    }

    if (inList) {
      chunks.push('</ul>');
      inList = false;
    }
    const paragraph = formatInline(escapeHtml(trimmed));
    chunks.push(`<p>${paragraph}</p>`);
  }

  if (inList) {
    chunks.push('</ul>');
  }

  return chunks.join('');
}
