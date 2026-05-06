import "highlight.js/styles/atom-one-dark.css";

import { type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Tailwind-styled prose theme matching the gladiatorial design language.
 * Each markdown node maps to a hand-styled element so we never inherit
 * @tailwindcss/typography defaults.
 */
const components: Components = {
  h1: ({ children, ...rest }: ComponentProps<"h1">) => (
    <h1 className="carved mb-6 mt-2 text-3xl uppercase sm:text-4xl" {...rest}>
      {children}
    </h1>
  ),
  h2: ({ children, ...rest }: ComponentProps<"h2">) => (
    <h2
      className="mb-3 mt-14 border-b border-gold-700/30 pb-2 font-display text-xl uppercase tracking-imperial text-gold-200 sm:text-2xl"
      {...rest}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...rest }: ComponentProps<"h3">) => (
    <h3
      className="mb-2 mt-10 font-display text-base uppercase tracking-imperial text-gold-300"
      {...rest}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...rest }: ComponentProps<"h4">) => (
    <h4
      className="mb-2 mt-6 font-display text-sm uppercase tracking-imperial text-gold-400"
      {...rest}
    >
      {children}
    </h4>
  ),
  p: ({ children }: ComponentProps<"p">) => (
    <p className="my-4 font-body text-base leading-relaxed text-stone-100 sm:text-[17px]">
      {children}
    </p>
  ),
  a: ({ href, children, ...rest }: ComponentProps<"a">) => {
    const linkClass =
      "text-gold-300 underline decoration-gold-700/60 underline-offset-4 transition-colors hover:text-gold-200 hover:decoration-gold-500";
    if (href && /^https?:\/\//.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={linkClass} {...rest}>
          {children}
        </a>
      );
    }
    if (href && href.startsWith("/")) {
      return (
        <Link to={href} className={linkClass}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={linkClass} {...rest}>
        {children}
      </a>
    );
  },
  ul: ({ children }: ComponentProps<"ul">) => (
    <ul className="my-4 ml-6 list-outside list-disc space-y-2 marker:text-gold-600">
      {children}
    </ul>
  ),
  ol: ({ children }: ComponentProps<"ol">) => (
    <ol className="my-4 ml-6 list-outside list-decimal space-y-2 marker:font-display marker:text-gold-500">
      {children}
    </ol>
  ),
  li: ({ children }: ComponentProps<"li">) => (
    <li className="font-body text-base leading-relaxed text-stone-100 sm:text-[17px]">
      {children}
    </li>
  ),
  blockquote: ({ children }: ComponentProps<"blockquote">) => (
    <blockquote className="my-5 border-l-2 border-gold-600/60 bg-night-800/30 px-5 py-3 font-body italic text-stone-200">
      {children}
    </blockquote>
  ),
  hr: () => <div className="gold-rule my-10 opacity-50" />,
  table: ({ children }: ComponentProps<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="readout w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: ComponentProps<"thead">) => (
    <thead className="border-b border-gold-700/40">{children}</thead>
  ),
  tr: ({ children }: ComponentProps<"tr">) => (
    <tr className="border-b border-stone-700/30 last:border-b-0">{children}</tr>
  ),
  th: ({ children }: ComponentProps<"th">) => (
    <th className="px-3 py-2 text-left font-display text-[10px] uppercase tracking-carved text-gold-300">
      {children}
    </th>
  ),
  td: ({ children }: ComponentProps<"td">) => (
    <td className="px-3 py-2 align-top font-body text-sm text-stone-100">
      {children}
    </td>
  ),
  code: ({
    inline,
    className,
    children,
    ...rest
  }: ComponentProps<"code"> & { inline?: boolean }) => {
    if (inline) {
      return (
        <code
          className="readout rounded-sm border border-stone-700/50 bg-night-800/70 px-1.5 py-0.5 text-[13px] text-gold-100"
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`readout text-[13px] ${className ?? ""}`} {...rest}>
        {children}
      </code>
    );
  },
  pre: ({ children }: ComponentProps<"pre">) => (
    <pre className="my-6 overflow-x-auto rounded-sm border border-gold-700/30 bg-night-900/80 p-4 leading-relaxed shadow-chiseled">
      {children}
    </pre>
  ),
  strong: ({ children }: ComponentProps<"strong">) => (
    <strong className="font-semibold text-gold-100">{children}</strong>
  ),
  em: ({ children }: ComponentProps<"em">) => (
    <em className="italic text-stone-50">{children}</em>
  ),
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, [rehypeHighlight, { ignoreMissing: true }]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
