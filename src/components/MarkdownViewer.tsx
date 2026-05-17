import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-semibold text-os-text first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 border-b border-os-border pb-1 text-base font-semibold text-os-text">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-os-text">{children}</h3>,
          p: ({ children }) => <p className="mb-2 text-sm leading-relaxed text-os-secondary">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 space-y-1 pl-4">{children}</ul>,
          li: ({ children }) => <li className="text-sm text-os-secondary list-disc">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-os-elevated px-1.5 py-0.5 text-xs text-os-text">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-md border border-os-border bg-os-elevated p-3">{children}</pre>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-os-cyan hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          input: ({ checked, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
            if (type === 'checkbox') {
              return <input type="checkbox" checked={checked} readOnly className="mr-2 h-3.5 w-3.5 accent-os-cyan" />;
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
