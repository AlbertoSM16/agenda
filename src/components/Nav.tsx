"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck, CheckSquare, Dumbbell, LayoutDashboard, NotebookPen, ShoppingCart, Wallet, type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon; color: string; badge?: "events" | "tasks" }[] = [
  { href: "/", label: "Resumen", icon: LayoutDashboard, color: "text-slate-300" },
  { href: "/calendario", label: "Agenda", icon: CalendarCheck, color: "text-indigo-400", badge: "events" },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, color: "text-sky-400", badge: "tasks" },
  { href: "/finanzas", label: "Gastos e ingresos", icon: Wallet, color: "text-emerald-400" },
  { href: "/entrenos", label: "Entrenamiento", icon: Dumbbell, color: "text-amber-400" },
  { href: "/notas", label: "Notas", icon: NotebookPen, color: "text-violet-400" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, color: "text-rose-400" },
];

export default function Nav({ counts }: { counts: { events: number; tasks: number } }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1.5 overflow-x-auto p-3 lg:flex-col lg:p-4" aria-label="Navegación principal">
      {LINKS.map(({ href, label, icon: Icon, color, badge }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        const count = badge ? counts[badge] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all ${
              active
                ? "border-slate-600/60 bg-slate-800/95 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                : "border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className={`h-4 w-4 ${color}`} aria-hidden />
              {label}
            </span>
            {count > 0 && (
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">{count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
