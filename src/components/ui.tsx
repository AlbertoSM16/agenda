import Link from "next/link";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-slate-500">{children}</p>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-200 p-1 text-sm">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-md px-3 py-1 ${t.active ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function DbError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">⚠️ {message}</p>;
}
