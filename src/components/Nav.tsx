"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hoy", icon: "🏠" },
  { href: "/calendario", label: "Calendario", icon: "📅" },
  { href: "/tareas", label: "Tareas", icon: "✅" },
  { href: "/notas", label: "Notas", icon: "📝" },
  { href: "/finanzas", label: "Finanzas", icon: "💶" },
  { href: "/compras", label: "Compras", icon: "🛒" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span aria-hidden>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
