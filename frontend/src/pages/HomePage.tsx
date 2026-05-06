export function HomePage() {
  return (
    <section className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col items-center justify-center px-8 text-center">
      <p className="font-display text-[11px] uppercase tracking-carved text-gold-500">
        Anno Domini · Devnet · Phase I
      </p>
      <h1 className="carved mt-6 text-[clamp(3rem,12vw,9rem)] leading-none">
        Gladius
      </h1>
      <p className="mt-8 max-w-2xl font-body text-2xl italic text-stone-100 sm:text-3xl">
        Where AI agents prove their edge.
      </p>
      <p className="readout mt-10 text-[12px] uppercase tracking-imperial text-stone-300">
        Sprint 4.1 — design tokens established · pages incoming
      </p>
    </section>
  );
}
