# CLAUDE.md

## Resumen del proyecto

SaaS de salud pensado como 5 microservicios (ver HLD en memoria de proyecto /
`hld-saas-salud-microservicios.excalidraw`), construido por 1 persona en 3
meses part-time. El repo es un **monorepo con pnpm workspaces**, un directorio
por servicio en la raíz. Solo dos servicios tienen código real hoy:

- **`identity-patient/`** — el boilerplate open-source
  [ixartz/SaaS-Boilerplate](https://react-saas.com) (Next.js + Clerk),
  todavía sin adaptar al dominio de salud: auth/multi-tenancy vía Clerk ya
  funciona, pero no hay modelos, rutas ni copy específicos de pacientes/citas
  más allá de lo genérico del template.
- **`notification/`** — servicio nuevo, mínimo (solo API routes de Next.js),
  con un servicio de mail reutilizable sobre Mailtrap. Primer caso de uso:
  correo de bienvenida disparado por webhook de Clerk (`user.created`).

`ehr-prescriptions/`, `billing/` y `telehealth/` son carpetas **stub**: solo
tienen un `README.md` con el alcance previsto, no hay código.

## Estructura del monorepo

```
SaaS-EasyHealth/
  package.json          ← raíz (packageManager: pnpm), sin lógica propia
  pnpm-workspace.yaml    ← lista de workspaces (identity-patient, notification)
  identity-patient/      ← Next.js completo (frontend + auth + dashboard)
  notification/          ← Next.js mínimo, API-only (mail vía Mailtrap)
  ehr-prescriptions/      ← stub, solo README
  billing/                ← stub, solo README
  telehealth/              ← stub, solo README
  .github/workflows/
    identity-patient-ci.yml  ← build/lint/test/e2e + deploy a Vercel (gateado)
    notification-ci.yml      ← build/lint/test + deploy a Vercel (gateado)
    checkly.yml / crowdin.yml / release.yml  ← auxiliares de identity-patient
  skills/analizar-repo, skills/saas-builder  ← skills de Claude Code
```

`pnpm install` desde la raíz instala ambos workspaces con un solo lockfile
(`pnpm-lock.yaml` en la raíz). Cada servicio tiene su propio
`package.json`/scripts — se ejecutan con `pnpm --filter <servicio> run
<script>` desde la raíz, o `cd <servicio> && pnpm run <script>`. El gestor de
paquetes está fijado vía el campo `packageManager` del `package.json` raíz.

## `identity-patient/`

- Stack: TypeScript strict, Next.js App Router, React 19, Tailwind + Shadcn
  UI, Drizzle ORM (Postgres/Neon en prod, PGlite en local), Clerk (auth +
  multi-tenancy + roles), React Hook Form + Zod, next-intl + Crowdin, LogTape
  + Better Stack, Sentry, Vitest + Playwright + Storybook.
- Arquitectura: App Router + "feature folders" (no DDD/hexagonal/MVC).
  `src/app/[locale]/` (rutas, grupos `(marketing)` y `(auth)`),
  `src/features/` (UI por área funcional: `billing`, `dashboard`, `landing`,
  `sponsors`), `src/models/Schema.ts` (Drizzle, solo tabla `todo` de
  ejemplo), `src/libs/` (Env, DB, I18n, Logger).
- Cómo correr (desde `identity-patient/`): `pnpm dev` (dev + PGlite local)
  · `pnpm build-local` · `pnpm test` · `pnpm test:e2e` · `pnpm lint` ·
  `pnpm check:types` · `pnpm db:generate`/`db:migrate` · `pnpm storybook`.
- Variables de entorno nuevas van en `src/libs/Env.ts` (T3 Env), nunca
  `process.env` directo. Cambios a `src/models/Schema.ts` requieren
  `pnpm db:generate`.

## `notification/`

- Stack: Next.js mínimo (sin páginas, solo `src/app/api/`), `nodemailer`
  (SMTP vía Mailtrap), `svix` (verificación de firma de webhooks de Clerk),
  T3 Env + Zod (mismo patrón que `identity-patient`).
- `src/libs/Mail.ts`: `sendMail()` genérico (reutilizable para futuras
  notificaciones: recordatorios de citas, avisos de billing) y
  `sendWelcomeEmail()`.
- `src/app/api/webhooks/clerk/route.ts`: recibe el webhook `user.created` de
  Clerk, verifica la firma con `svix`, dispara `sendWelcomeEmail`. Corre en
  runtime Node (no Edge) porque `nodemailer` lo requiere.
- Cómo correr (desde `notification/`): `pnpm dev` (puerto 3009) ·
  `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm check:types`.
- Sin base de datos propia — es stateless, solo reacciona a eventos/webhooks.

## CI/CD

- Un workflow por servicio (`identity-patient-ci.yml`, `notification-ci.yml`),
  disparado solo cuando cambia la carpeta de ese servicio (`paths:`).
- Cada workflow termina en un job `deploy` que corre **solo si todos los
  checks anteriores pasan** (`needs: [...]`) y solo en push a `main` — usa
  Vercel CLI (`vercel pull/build/deploy --prod`), no la integración nativa de
  Vercel (que desplegaría aunque los tests fallen).
- Son dos proyectos de Vercel distintos, con secrets separados:
  `IDENTITY_PATIENT_VERCEL_{TOKEN,ORG_ID,PROJECT_ID}` y
  `NOTIFICATION_VERCEL_{TOKEN,ORG_ID,PROJECT_ID}`.
- `checkly.yml` y `release.yml` (raíz de `.github/workflows/`) siguen
  atados a `identity-patient/` (`working-directory` ajustado tras el
  monorepo).

## Convenciones del equipo

- Commits: Commitlint + Commitizen, config a nivel de repo (`commitlint.config.ts`
  en la raíz, aplica a todo el monorepo).
- Git hooks con Lefthook (`lefthook.yml`, raíz) — los jobs de lint/types/knip
  corren con `root: identity-patient/` hasta que `notification/` (u otros
  servicios) necesiten su propio hook.
- ESLint con Antfu config en cada servicio (`eslint.config.mjs` propio por
  servicio, no compartido).

## Notas y advertencias

- **`identity-patient/` sigue siendo el boilerplate sin adaptar al dominio de
  salud.** Auth/multi-tenancy funciona (Clerk), pero no hay modelos, rutas ni
  copy de pacientes/citas — ver HLD en memoria de proyecto para el alcance
  real de "Identity & patient".
- **`ehr-prescriptions/`, `billing/`, `telehealth/` no tienen código.** Son
  placeholders con README para que la estructura objetivo del monorepo sea
  visible; no asumir que existe lógica ahí.
- **Deploy y CI aún no están operativos end-to-end.** Los jobs `deploy`
  esperan secrets de Vercel que todavía no se cargaron (ver checklist al
  final de la conversación donde se implementó esto). Hasta que se carguen,
  el job `deploy` fallará o no correrá.
- **`checkly.yml` puede haber quedado desconectado.** Reacciona al evento
  `deployment_status` de GitHub, que originalmente disparaba la integración
  nativa de Vercel; con el deploy vía Vercel CLI gateado por CI, no está
  confirmado que ese evento se siga disparando — revisar si Checkly deja de
  correr después de un deploy.
- No se encontró Dockerfile ni docker-compose en ningún servicio.
