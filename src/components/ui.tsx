import { ArrowRight, CalendarDays } from "lucide-react";
import { fmtDate, todayISO } from "@/lib/format";
import Link from "next/link";

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center">
      <div>
        <div className="mb-1 flex items-center gap-2 font-mono text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
          <span>{capitalize(fmtDate(todayISO(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-800 py-8 text-center text-sm text-slate-400">{children}</p>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Tabs({ items }: { items: { href: string; label: React.ReactNode; active: boolean }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
            t.active ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Tarjeta KPI del estilo del panel. */
export function Kpi({
  label, value, hint, icon, accent = "indigo", href, extra,
}: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet"; href?: string; extra?: React.ReactNode;
}) {
  const a = ACCENTS[accent];
  const body = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <div className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${a.icon}`}>{icon}</div>}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-white">{value}</span>
        {extra && <span className={`rounded-md px-2 py-0.5 font-mono text-xs ${a.pill}`}>{extra}</span>}
      </div>
      {hint && <p className="mt-2 truncate text-xs text-slate-400">{hint}</p>}
    </>
  );
  const cls = `group card block transition-all ${a.hover}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export const ACCENTS = {
  indigo: { icon: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400", pill: "bg-indigo-500/10 text-indigo-300", hover: "hover:border-indigo-500/40", dot: "bg-indigo-400", text: "text-indigo-400" },
  emerald: { icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", pill: "bg-emerald-500/10 text-emerald-400", hover: "hover:border-emerald-500/40", dot: "bg-emerald-400", text: "text-emerald-400" },
  amber: { icon: "border-amber-500/20 bg-amber-500/10 text-amber-400", pill: "bg-amber-500/10 text-amber-300", hover: "hover:border-amber-500/40", dot: "bg-amber-400", text: "text-amber-400" },
  rose: { icon: "border-rose-500/20 bg-rose-500/10 text-rose-400", pill: "bg-rose-500/10 text-rose-300", hover: "hover:border-rose-500/40", dot: "bg-rose-400", text: "text-rose-400" },
  sky: { icon: "border-sky-500/20 bg-sky-500/10 text-sky-400", pill: "bg-sky-500/10 text-sky-300", hover: "hover:border-sky-500/40", dot: "bg-sky-400", text: "text-sky-400" },
  violet: { icon: "border-violet-500/20 bg-violet-500/10 text-violet-400", pill: "bg-violet-500/10 text-violet-300", hover: "hover:border-violet-500/40", dot: "bg-violet-400", text: "text-violet-400" },
} as const;

/** Cabecera de tarjeta con punto de color y enlace opcional. */
export function CardTitle({ title, accent = "indigo", href, linkLabel = "Ver todo", children }: {
  title: string; accent?: keyof typeof ACCENTS; href?: string; linkLabel?: string; children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ACCENTS[accent].dot}`} />
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
      {href && (
        <Link href={href} className={`flex items-center gap-1 text-xs font-medium hover:opacity-80 ${ACCENTS[accent].text}`}>
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function DbError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="notice-error mb-4">⚠️ {message}</p>;
}
