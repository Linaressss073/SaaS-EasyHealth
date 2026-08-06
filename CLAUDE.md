# CLAUDE.md

## Resumen del proyecto

SaaS de salud pensado como 5 microservicios (ver HLD en memoria de proyecto /
`hld-saas-salud-microservicios.excalidraw`), construido por 1 persona en 3
meses part-time. **Este repositorio es el repo "meta"**: documentación,
arquitectura objetivo (HLD) y skills de Claude Code — no tiene código de
ningún servicio. Cada microservicio con código real vive en su propio
repositorio de GitHub:

- **[easyhealth-identity-patient](https://github.com/Linaressss073/easyhealth-identity-patient)**
  — el boilerplate open-source [ixartz/SaaS-Boilerplate](https://react-saas.com)
  (Next.js + Clerk), todavía sin adaptar al dominio de salud: auth/multi-tenancy
  vía Clerk ya funciona, pero no hay modelos, rutas ni copy específicos de
  pacientes/citas más allá de lo genérico del template.
- **[easyhealth-notification](https://github.com/Linaressss073/easyhealth-notification)**
  — servicio nuevo, mínimo (solo API routes de Next.js), con un servicio de
  mail reutilizable sobre Mailtrap. Primer caso de uso: correo de bienvenida
  disparado por webhook de Clerk (`user.created`).

`ehr-prescriptions/`, `billing/` y `telehealth/` siguen como carpetas
**stub** acá mismo (solo `README.md` con el alcance previsto) — se migran a
su propio repositorio recién cuando tengan código real, siguiendo el mismo
patrón que los dos anteriores.

## Historia: de monorepo a multi-repo

El proyecto arrancó como un monorepo con pnpm workspaces (`identity-patient/`
y `notification/` como carpetas). Se migró a un repositorio por servicio
manteniendo el historial de git de cada uno (`git subtree split` +
`git push` a los repos nuevos) porque:

- Cada servicio termina siendo su propio deploy de Vercel — un repo por
  servicio es la forma nativa/esperada de conectar eso, sin tener que
  configurar "root directory" ni path-filtering en el CI.
- Evita que un cambio en un servicio dispare CI/lint/knip de los demás.
- Facilita que cada servicio tenga sus propias convenciones si hace falta
  (aunque hoy comparten el mismo stack/patrones).

Este repo (`SaaS-EasyHealth`) quedó como el punto de referencia de la
arquitectura completa — el lugar para el HLD, decisiones cross-servicio, y
las skills de Claude Code que se usan para trabajar en cualquiera de los
repos del proyecto.

## Estructura de este repo

```
SaaS-EasyHealth/
  CLAUDE.md, README.md    ← este archivo
  ehr-prescriptions/       ← stub, solo README (sin repo propio todavía)
  billing/                 ← stub, solo README (sin repo propio todavía)
  telehealth/               ← stub, solo README (sin repo propio todavía)
  skills/analizar-repo, skills/saas-builder  ← skills de Claude Code
  .claude/                  ← config de Claude Code para este repo
```

## Convenciones que se repiten en cada repo de servicio

Documentado acá porque aplica a todos, pero vive configurado en cada repo
individual (no hay nada compartido/publicado como paquete):

- Stack base: TypeScript strict, Next.js App Router, pnpm, Vitest, ESLint
  con Antfu config, T3 Env (nunca `process.env` directo).
- Commits: Commitlint + Commitizen (`commitlint.config.ts` propio por repo,
  mismo contenido).
- Git hooks con Lefthook (`lefthook.yml` propio por repo): pre-commit corre
  `lint` → `check-types` → `knip` **secuencial** (`piped: true`) llamando a
  los binarios de `node_modules/.bin/` directo en vez de vía `pnpm run` —
  se detectó que invocar pnpm ahí disparaba una resincronización del store
  que a veces dejaba paquetes sin enlazar a mitad de la corrida.
- CI/CD: un workflow `ci.yml` por repo (build → static checks → unit →
  [storybook/e2e si aplica]) que termina en un job `deploy` gateado —
  **solo corre si todos los checks anteriores pasaron**, y usa Vercel CLI
  (`vercel pull/build/deploy --prod`), no la integración nativa de Vercel
  (que desplegaría aunque los tests fallen). Secrets por repo:
  `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## Notas y advertencias

- **`easyhealth-identity-patient` sigue siendo el boilerplate sin adaptar al
  dominio de salud.** Auth/multi-tenancy funciona (Clerk), pero no hay
  modelos, rutas ni copy de pacientes/citas — ver HLD en memoria de proyecto
  para el alcance real de "Identity & patient".
- **`ehr-prescriptions/`, `billing/`, `telehealth/` no tienen código.** Son
  placeholders con README para que la estructura objetivo sea visible; no
  asumir que existe lógica ahí.
- **Setup externo pendiente** (Vercel, Clerk, Mailtrap, Crowdin, Codecov,
  Chromatic, Checkly, Sentry) — ver checklist en la conversación donde se
  armó el plan de migración; nada de esto bloquea el código, solo el
  deploy/CI end-to-end.
- No se encontró Dockerfile ni docker-compose en ningún servicio.
