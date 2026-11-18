"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { garminAutoSync } from "@/lib/actions-entrenos";

/** Lanza una sincronización con Garmin al abrir la página, sin bloquear la carga. */
export default function AutoSync() {
  const router = useRouter();
  const started = useRef(false);
  const [msg, setMsg] = useState("⏳ Sincronizando con Garmin…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    garminAutoSync()
      .then((r) => {
        if (r.error) setMsg(`⚠️ ${r.error}`);
        else if (r.imported) {
          setMsg(`✓ ${r.imported} entreno${r.imported === 1 ? "" : "s"} nuevo${r.imported === 1 ? "" : "s"}`);
          router.refresh();
        } else setMsg("✓ Todo al día");
      })
      .catch((e) => setMsg(`⚠️ ${String(e)}`));
  }, [router]);

  return <span className="text-xs text-slate-400">{msg}</span>;
}
