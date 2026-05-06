import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/seasons", label: "Seasons" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/register", label: "Enter Arena" },
];

export function Layout() {
  return (
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <AmbientBackdrop />
      <Header />
      <main className="relative z-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <NavLink to="/" className="group flex items-center gap-3">
          <SigilMark />
          <span className="carved text-2xl uppercase">Gladius</span>
        </NavLink>
        <nav className="font-display text-[11px] uppercase tracking-imperial">
          <ul className="flex items-center gap-10">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `transition-colors duration-300 ${
                      isActive
                        ? "text-gold-300"
                        : "text-stone-200 hover:text-gold-200"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="gold-rule opacity-60" />
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mt-32">
      <div className="gold-rule opacity-30" />
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-[10px] uppercase tracking-carved text-stone-300">
          Audentes Fortuna Iuvat
        </p>
        <p className="readout text-[11px] text-stone-400">
          devnet · 6R9YnVRjEryqxDbE4p6PQvP6PaPuXKhntojAU7RzmSDA
        </p>
      </div>
    </footer>
  );
}

function SigilMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 text-gold-400"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sword" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="14.25"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.75"
      />
      <path
        d="M16 4 L18 22 L16 26 L14 22 Z"
        fill="url(#sword)"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.5"
      />
      <path
        d="M9 20 L23 20"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AmbientBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-stone-grain opacity-[0.18]"
    />
  );
}
