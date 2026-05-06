import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { DocSidebar } from "../components/docs/DocSidebar";
import { MarkdownRenderer } from "../components/docs/MarkdownRenderer";
import { DOCS, findDoc } from "../lib/docs";

export function DocsPage() {
  const { slug } = useParams<{ slug?: string }>();
  const doc = findDoc(slug);

  // Reset scroll when navigating between docs.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [slug]);

  if (!slug) {
    return <Navigate to={`/docs/${DOCS[0].slug}`} replace />;
  }

  if (!doc) {
    return (
      <section className="mx-auto max-w-7xl px-8 pb-24 pt-12">
        <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
          Lost in the colosseum
        </p>
        <h1 className="carved mt-4 text-4xl uppercase">No such doc</h1>
        <p className="mt-4 font-body text-lg italic text-stone-200">
          The slug <code className="readout text-gold-200">{slug}</code> isn't
          one of ours.{" "}
          <Link to="/docs" className="text-gold-300 underline decoration-gold-700/60 hover:text-gold-200">
            Back to the index.
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="relative mx-auto max-w-7xl px-8 pb-24 pt-10">
      <Breadcrumb title={doc.title} />

      <div className="mt-6 grid gap-12 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">
          <DocSidebar activeSlug={doc.slug} />
        </aside>

        <article className="min-w-0">
          <header className="border-b border-gold-700/30 pb-6">
            <p className="font-display text-[10px] uppercase tracking-carved text-gold-500">
              {doc.group}
            </p>
            <p className="mt-3 font-body text-lg italic leading-snug text-stone-200">
              {doc.blurb}
            </p>
          </header>
          <div className="mt-2">
            <MarkdownRenderer content={doc.content} />
          </div>
        </article>
      </div>
    </section>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-3 font-display text-[10px] uppercase tracking-carved text-stone-300"
    >
      <Link to="/docs" className="transition-colors hover:text-gold-300">
        Docs
      </Link>
      <span className="text-stone-600">·</span>
      <span className="text-gold-200">{title}</span>
    </nav>
  );
}
