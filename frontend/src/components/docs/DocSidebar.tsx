import { NavLink } from "react-router-dom";

import { DOC_GROUPS, docsByGroup } from "../../lib/docs";

interface DocSidebarProps {
  activeSlug?: string;
}

export function DocSidebar({ activeSlug }: DocSidebarProps) {
  return (
    <nav className="flex flex-col gap-8" aria-label="Documentation sections">
      {DOC_GROUPS.map((group) => {
        const docs = docsByGroup(group);
        if (docs.length === 0) return null;
        return (
          <section key={group} className="flex flex-col gap-2">
            <h3 className="font-display text-[10px] uppercase tracking-carved text-gold-500">
              {group}
            </h3>
            <ul className="flex flex-col gap-px border-l border-gold-700/20">
              {docs.map((doc) => {
                const active = doc.slug === activeSlug;
                return (
                  <li key={doc.slug}>
                    <NavLink
                      to={`/docs/${doc.slug}`}
                      className={`block border-l-2 px-3 py-2 text-sm leading-snug transition-colors ${
                        active
                          ? "border-gold-400/80 text-gold-100"
                          : "border-transparent text-stone-200 hover:border-gold-700/60 hover:text-gold-200"
                      }`}
                    >
                      <span className="font-display text-[11px] uppercase tracking-imperial">
                        {doc.title}
                      </span>
                      <span className="mt-0.5 block font-body text-[12px] italic leading-snug text-stone-300">
                        {doc.blurb}
                      </span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
