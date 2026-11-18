import { eur } from "@/lib/format";

export const CHART_COLORS = ["#34d399", "#818cf8", "#fbbf24", "#fb7185", "#38bdf8", "#a78bfa", "#fb923c", "#2dd4bf", "#f472b6", "#a3e635"];
const OTHER = "#475569";

/** Gráfico circular (anillo) en SVG puro, con leyenda. */
export default function Donut({
  items, max = 7, centerLabel = "Total", hrefFor, selected,
}: {
  items: [string, number][]; max?: number; centerLabel?: string; hrefFor?: (label: string) => string; selected?: string;
}) {
  const total = items.reduce((s, [, v]) => s + v, 0);
  const top = items.slice(0, max);
  const rest = items.slice(max).reduce((s, [, v]) => s + v, 0);
  const segs = rest > 0 ? [...top, ["Resto", rest] as [string, number]] : top;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Distribución por categoría">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="#1e293b" strokeWidth="5" />
          {segs.map(([label, v], i) => {
            const pct = (v / total) * 100;
            const el = (
              <circle
                key={label} cx="21" cy="21" r="15.915" fill="none"
                stroke={label === "Resto" ? OTHER : CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={selected === label ? 6.5 : 5}
                strokeDasharray={`${Math.max(pct - 0.6, 0.01)} ${100 - Math.max(pct - 0.6, 0.01)}`}
                strokeDashoffset={-acc}
              >
                <title>{`${label}: ${eur(v)} (${Math.round(pct)}%)`}</title>
              </circle>
            );
            acc += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-400">{centerLabel}</span>
          <span className="font-mono text-lg font-bold text-white">{eur(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {segs.map(([label, v], i) => {
          const color = label === "Resto" ? OTHER : CHART_COLORS[i % CHART_COLORS.length];
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className={`truncate ${selected === label ? "font-semibold text-white" : "text-slate-300"}`}>{label}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-400">{eur(v)} · {Math.round((v / total) * 100)}%</span>
            </>
          );
          return (
            <li key={label}>
              {hrefFor && label !== "Resto" ? (
                <a href={hrefFor(label)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-800/60">{row}</a>
              ) : (
                <div className="flex items-center justify-between gap-2 px-2 py-1">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
