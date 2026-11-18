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

## 4. Conectar Google Calendar (avisos en el móvil)

Los eventos del calendario pueden copiarse automáticamente en tu Google Calendar. Al crear, editar o borrar un evento en la agenda, el cambio también se hace en Google, con el aviso que elijas en el campo **Aviso**. Así Google te avisará en el móvil.

1. Ejecuta `supabase/migrations/0002_google_calendar.sql` en el SQL Editor de Supabase.
2. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto (o usa uno que ya tengas).
3. **APIs y servicios → Biblioteca**: busca **Google Calendar API** y pulsa *Habilitar*.
4. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform):
   - Tipo de usuario **Externo**; rellena el nombre de la app y tu email.
   - En *Acceso a datos / Permisos* añade `.../auth/calendar.events` y `.../auth/calendar.readonly`.
   - En *Público*, pulsa **Publicar app** para ponerla *En producción*. **Importante:** si la dejas en modo *Prueba*, Google caduca la conexión cada 7 días. Al conectar te saldrá el aviso "Google no ha verificado esta app": pulsa *Configuración avanzada → Ir a (tu app)*. Es normal en una app de uso personal.
5. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo *Aplicación web*. En **URIs de redireccionamiento autorizados** añade:
   - `http://localhost:3000/api/google/callback`
   - `https://TU-APP.vercel.app/api/google/callback` (y tu dominio propio si tienes uno)
6. Copia el *ID de cliente* y el *Secreto* a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, en `.env.local` y en las variables de entorno de Vercel. Después vuelve a desplegar.
7. En la app, ve a **Calendario → Conectar Google Calendar** y acepta los permisos. Con **Sincronizar eventos futuros** subes a Google los eventos que ya tenías.

Notas:
- La sincronización va de la agenda a Google. Los cambios que hagas directamente en Google no vuelven a la agenda. Si borras un evento en Google y luego lo editas en la agenda, se vuelve a crear.
- El aviso "Predeterminado de Google" usa los avisos por defecto de tu calendario. Puedes elegir "Sin aviso" o desde "a la hora del evento" hasta "1 semana antes".

## Estructura

```
supabase/migrations/               esquema de la base de datos y políticas RLS
src/middleware.ts                   sesión y redirección a /login
src/lib/actions.ts                  Server Actions (crear, editar, borrar…)
src/lib/supabase/server.ts          cliente Supabase en el servidor
src/lib/google.ts                   API de Google Calendar (OAuth, crear/editar/borrar eventos)
src/app/api/google/…                conexión OAuth con Google
src/app/(app)/…                     páginas: inicio, calendario, tareas, notas, finanzas, compras
src/components/                     componentes compartidos
```
