# 📒 Mi Agenda

Agenda personal web para volcar todo en un solo sitio:

- **Hoy**: resumen del día (eventos de hoy y de la semana, tareas urgentes, balance del mes, total de la lista de compras).
- **Calendario**: reuniones, eventos y citas en vista mensual, con lugar, asistentes y **notas/acta** de cada reunión.
- **Tareas**: prioridad, fecha límite, estado, filtros (pendientes / hechas / todas).
- **Notas**: tu base de conocimiento, con etiquetas y búsqueda de texto completo en español.
- **Finanzas**: gastos e ingresos diarios, balance mensual, gasto medio diario y desglose por categoría.
- **Compras**: lista de cosas que quieres comprar con precio estimado y prioridad. Al marcar algo como comprado puede registrarse solo como gasto.

Stack: Next.js 15 (App Router, Server Actions) + Tailwind CSS, con Supabase (Postgres + Auth). Se despliega en Vercel.

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/migrations/0001_init.sql` y ejecútalo.
3. En **Authentication → Sign In / Providers → Email**, desactiva **Allow new users to sign up** para que nadie más pueda registrarse.
4. En **Authentication → Users → Add user → Create new user**, crea tu usuario con tu email y contraseña (marca *Auto Confirm User*).
5. En **Project Settings → API** copia la **Project URL** y la clave **anon / publishable**.

Todas las tablas tienen Row Level Security: cada usuario solo puede ver y modificar sus propios datos.

## 2. Ejecutarlo en local

```bash
cp .env.example .env.local   # y rellena las variables
npm install
npm run dev                  # http://localhost:3000
```

## 3. Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** e importa el repositorio (Vercel detecta Next.js solo).
3. En **Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_TZ` = `Europe/Madrid` (u otra zona; se usa para saber qué día es "hoy")
4. **Deploy**. Cada `git push` volverá a desplegar automáticamente.

## Estructura

```
supabase/migrations/0001_init.sql   esquema de la base de datos y políticas RLS
src/middleware.ts                   sesión y redirección a /login
src/lib/actions.ts                  Server Actions (crear, editar, borrar…)
src/lib/supabase/server.ts          cliente Supabase en el servidor
src/app/(app)/…                     páginas: inicio, calendario, tareas, notas, finanzas, compras
src/components/                     componentes compartidos
```
