# CLAUDE.md — Mi Agenda

Agenda personal de Alberto, de **un solo usuario**: agenda/eventos, tareas, notas, finanzas (gastos, ingresos y ahorro), lista de compras y entrenamientos sincronizados con Garmin. **Todo el texto de la interfaz va en español** (España). El usuario se comunica en español.

## Stack
- Next.js 15 (App Router, Server Components + **Server Actions**, sin API propia salvo `src/app/api/google/*`), React 19, TypeScript estricto.
- Tailwind CSS 3 (tema oscuro, ver "Diseño"), iconos `lucide-react`, fuentes Inter + JetBrains Mono vía `next/font`.
- Supabase (Postgres + Auth) con `@supabase/ssr`. Sin ORM: consultas con `supabase.from(...)`.
- Despliegue en **Vercel** (proyecto `agenda1`). Ojo: el proyecto de Vercel estuvo conectado al repo `AlbertoSM16/agenda1`, mientras que el remoto local es `AlbertoSM16/agenda`. Comprueba de qué repo despliega Vercel antes de dar por hecho que un push llega a producción.

## Comandos
```bash
npm run dev            # desarrollo (requiere .env.local)
npm run build          # compila y comprueba tipos (no hay lint ni tests configurados)
npm run garmin:login   # plan B: login de Garmin en local → bloque de tokens para pegar en la web
```
Para comprobar que compila sin `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x npx next build`

## Estructura
```
src/middleware.ts                 refresca la sesión y redirige a /login si no hay usuario
src/app/(app)/layout.tsx          menú lateral (Nav) + contadores; todas las páginas privadas cuelgan de aquí
src/app/(app)/<sección>/page.tsx  calendario, tareas, notas, finanzas, compras, entrenos (+ [id], ejercicios)
src/app/(app)/page.tsx            panel "Resumen"
src/lib/actions.ts                Server Actions generales (eventos, tareas, notas, finanzas, compras, deleteRow)
src/lib/actions-entrenos.ts       Server Actions de entrenos, plan semanal y Garmin
src/lib/form.ts                   helpers str/num/back/required/withParam para leer FormData
src/lib/format.ts                 fechas, zona horaria, euros, ritmos, duraciones
src/lib/types.ts                  tipos + configuración visual (EVENT_TYPES, PRIORITIES, SPORTS, KINDS…)
src/lib/db.ts                     dbError(): convierte errores de Supabase en un aviso visible
src/lib/google.ts                 Google Calendar (OAuth + crear/editar/borrar eventos)
src/lib/garmin/                   cliente NO oficial de Garmin Connect (sso, api, sync, map, crypto)
src/components/ui.tsx             PageHeader, Kpi, CardTitle, Tabs, Field, Empty, DbError, ACCENTS
supabase/migrations/000N_*.sql    esquema; se ejecutan A MANO en el SQL Editor de Supabase, en orden
scripts/garmin-login.ts           se ejecuta con Node (strip-types); excluido del tsconfig
```

## Convenciones (síguelas)
- **Mutaciones = Server Actions** con `<form action={...}>`, sin JS de cliente. Tras guardar: `revalidatePath("/", "layout")` + `redirect(back(fd, fallback))`. El campo oculto `back` indica a dónde volver.
- **`redirect()` nunca dentro de un `try`**, porque lanza una excepción. Calcula el destino dentro del try/catch y redirige después (mira `garminLogin`).
- **Edición por URL**: `?edit=<id>` (o `?editar=1`) hace que la página rellene el formulario. Los avisos se pasan como query params (`?garmin=…`, `?gcal=…`, `?serie=…`).
- **Errores de lectura**: muestra siempre `<DbError message={dbError(res1, res2…)} />`. No ignores el `error` de Supabase, porque la página saldría vacía sin explicación.
- **Borrar**: `<DeleteButton table id back>` → `deleteRow`. Para borrar una tabla nueva, añádela a `TABLES` en `actions.ts`.
- En los `"use server"` solo se pueden **exportar funciones async**. Los helpers van en ficheros normales (`form.ts`, …).
- **Formularios**: usa `flex flex-col gap-N`, **no `space-y-N`**. React mete un input oculto como primer hijo en los forms con server actions y `space-y` descuadra el espaciado.
- Las listas con botones por fila usan forms pequeños con inputs ocultos (`id`, `back`). Mira `toggleTask` en el panel.

## Fechas y zona horaria
- Eventos y entrenos guardan **hora local sin zona** (`timestamp`, no `timestamptz`): "2026-11-18T09:00:00".
- "Hoy" se calcula con `todayISO()` / `nowLocalISO()` usando `NEXT_PUBLIC_TZ` (por defecto `Europe/Madrid`), porque Vercel corre en UTC. **Nunca uses `new Date()` directamente para decidir el día.**
- Para formatear fechas usa `fmtDate`/`fmtTime` (tratan la cadena como UTC para que no haya desfases). `monthLabel` ya devuelve la primera letra en mayúscula; no añadas la clase `capitalize` a textos con "de" (saldría "Noviembre De 2026").
- Semanas de lunes a domingo: `mondayOf()`, `weekdayOf()` (0 = lunes).

## Base de datos (Supabase)
- Cada tabla: `id uuid`, `user_id uuid default auth.uid()`, RLS con la política `"solo propietario"` y **`grant select, insert, update, delete … to authenticated`**. Los proyectos nuevos de Supabase NO dan permisos automáticos a la API: sin el GRANT, las consultas fallan con *permission denied* y la app sale vacía.
- Las migraciones nuevas van en `supabase/migrations/000N_nombre.sql` (la siguiente es la **0008**). Recuérdale al usuario que tiene que ejecutarlas en el SQL Editor; no hay CLI de Supabase conectada.
- Tablas: `events`, `tasks`, `notes` (con `fts` en español), `transactions` (`kind`: gasto | ingreso | ahorro), `recurring_transactions` (gastos fijos; los genera `ensureRecurring` en `src/lib/recurring.ts` al abrir Finanzas o el Resumen), `shopping_items`, `google_accounts`, `garmin_accounts`, `workouts`, `exercises`, `workout_sets`, `training_plan`.
- Para probar una migración: Postgres en Docker con un esquema `auth` simulado (`auth.users`, `auth.uid()` leyendo `request.jwt.claim.sub`, roles `authenticated`/`anon`).
- `supabase/import_*.sql` lleva **datos personales**: está en `.gitignore`. No lo subas nunca.

## Diseño (tema oscuro "Life OS")
- Fondo `bg-slate-950` (#090d16), tarjetas `.card` (slate-900, borde slate-800, `rounded-2xl`), tarjetas internas `.card-inner` (slate-850). Colores extra en `tailwind.config.ts`.
- Clases base en `globals.css`: `.card .card-inner .input .label .btn .btn-primary .btn-sm .badge .chip .h2 .kpi-label .notice-ok .notice-error`.
- **Color por sección** (`ACCENTS` en `ui.tsx`): agenda = índigo, tareas = sky, finanzas = esmeralda, entrenos = ámbar, notas = violeta, compras = rosa; rosa también para gastos y sky para ahorro.
- Cifras, fechas cortas e importes en `font-mono`. Insignias semitransparentes del tipo `bg-X-500/15 text-X-300 border-X-500/30`.
- Gráficos hechos a mano (SVG/CSS): `Donut.tsx` y barras con `style={{ height: % }}`. Sin librerías de gráficos.
- Nuevas páginas: `<PageHeader title>` + `<Kpi>` + `<CardTitle accent href>`. Prueba también a 390 px de ancho.

## Integraciones
- **Google Calendar** (`src/lib/google.ts`): sincroniza solo de la agenda a Google al guardar o borrar eventos. Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Si falla, el evento se guarda igualmente y se avisa con `?gcal=error_sync`.
- **Garmin** (API NO oficial, `src/lib/garmin/`):
  - `sso.ts` replica el login de *garth* (SSO → ticket → OAuth1 → OAuth2), con soporte de MFA. Usa solo `fetch` + `node:crypto` y debe seguir siendo compatible con Node strip-types (sin enums ni parameter properties, imports de tipos con `import type`), porque lo usa `scripts/garmin-login.ts`.
  - La contraseña **no se guarda nunca**. Los tokens se guardan cifrados con AES-256-GCM (`GARMIN_TOKEN_KEY`, 32 bytes en base64). Si cambia la clave, hay que volver a conectar.
  - `sync.ts` importa actividades nuevas (la primera vez, 180 días) con upsert por `(user_id, garmin_activity_id)`. Las vueltas se piden de forma diferida en el detalle (`ensureLaps`). Garmin da el peso de las series en gramos.
  - La sincronización automática la lanza `<AutoSync />` al abrir Entrenos si la última fue hace más de 1 h.
  - Garmin puede bloquear el login desde Vercel (403/429). Para eso está el plan B con `npm run garmin:login`.
- **Variables de entorno**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TZ`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GARMIN_TOKEN_KEY` (ver `.env.example`). Las `NEXT_PUBLIC_*` se incrustan al compilar: si cambian, **hay que redesplegar**.

## Verificar cambios
1. `npm run build` (con variables de prueba si no hay `.env.local`).
2. Lógica pura (formatos, `garmin/map.ts`, firma OAuth): script de Node con `--conditions=react-server` para poder importar módulos `server-only`.
3. Visual: compilar con `NEXT_PUBLIC_SUPABASE_URL=http://localhost:<puerto>` apuntando a un **Supabase simulado** (servidor Node que responde a `/auth/v1/user` y a `/rest/v1/<tabla>` con datos de ejemplo), meter la cookie `sb-localhost-auth-token` (`base64-` + sesión JSON) y hacer capturas con `puppeteer-core` usando `/usr/bin/google-chrome`. Todo esto va en el scratchpad, no en el repo.
4. Al matar procesos, **no uses `pkill -f`/`pgrep -f` con un patrón que aparezca en tu propio comando**, porque mata tu propia shell.

## Para el usuario
- Escribe las respuestas en español, sin tecnicismos innecesarios, y dile qué pasos tiene que hacer él (ejecutar SQL, variables de entorno en Vercel, redesplegar).
- Haz commit o push solo cuando te lo pida.

## Ideas pendientes / mejoras propuestas
- Botón "+" flotante de alta rápida en móvil y menú inferior tipo app.
- PWA (instalable, icono en la pantalla de inicio).
- Presupuestos por categoría con aviso al pasarse.
- Exportar movimientos o entrenos a CSV.
- Sincronización con Garmin programada con Vercel Cron (necesitaría `SUPABASE_SERVICE_ROLE_KEY`).
- Agenda: vista de día con línea de tiempo (como en el diseño original) y completar eventos.
