import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Sanitize schema: extend the safe default with the tag/attribute set the
 * chat/summary bubbles actually render. `script`/event handlers stay blocked
 * by the default schema — we only widen what's allowed.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Open links in a new tab without exposing the opener.
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data'],
  },
};

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Renders LLM output as Markdown. Shared by the Ask AI bubbles and the
 * Summary text. Uses rehype-raw (parse inline HTML) + rehype-sanitize
 * (whitelist filter) so untrusted model output cannot execute script.
 */
export const Markdown = memo(function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={className ? `markdown-body ${className}` : 'markdown-body'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeRaw, { allowDangerousHtml: true }], [rehypeSanitize, sanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
