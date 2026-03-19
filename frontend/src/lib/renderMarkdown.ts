import DOMPurify from 'dompurify';

/**
 * Convert a subset of Markdown to sanitised HTML.
 *
 * Handles: headings (h2–h4), bold, italic, code blocks, inline code,
 * bullet lists, numbered lists, and line breaks.
 *
 * All output is sanitised via DOMPurify to prevent XSS.
 */
export function renderMarkdown(text: string): string {
  const html = text
    // Headings (must come before bold to avoid ** conflict)
    .replace(/^####\s+(.+)$/gm, '<h4 class="font-semibold text-sm mt-2 mb-1">$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2 class="font-bold text-lg mt-3 mb-1">$1</h2>')
    // Code blocks (triple backtick)
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-background/50 rounded p-2 my-1 text-xs font-mono overflow-x-auto">$1</pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Bullet points (lines starting with - or *)
    .replace(/^[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Wrap consecutive bullet <li> in <ul>
    .replace(/((?:<li class="ml-4 list-disc">.*<\/li>\n?)+)/g, '<ul class="space-y-0.5 my-1">$1</ul>')
    // Wrap consecutive numbered <li> in <ol>
    .replace(/((?:<li class="ml-4 list-decimal">.*<\/li>\n?)+)/g, '<ol class="space-y-0.5 my-1">$1</ol>')
    // Line breaks
    .replace(/\n/g, '<br/>');

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h2', 'h3', 'h4', 'pre', 'code', 'strong', 'em', 'li', 'ul', 'ol', 'br', 'p', 'div', 'span'],
    ALLOWED_ATTR: ['class'],
  });
}
