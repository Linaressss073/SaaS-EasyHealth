# SaaS-EasyHealth

Monorepo (pnpm workspaces) para un SaaS de salud pensado como microservicios.
Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle de arquitectura, stack y cómo
correr cada servicio.

## Servicios

| Carpeta | Estado |
| --- | --- |
| [`identity-patient/`](./identity-patient) | Next.js boilerplate (Clerk auth + multi-tenancy), sin adaptar al dominio aún |
| [`notification/`](./notification) | Servicio de mail (Mailtrap) + webhook de bienvenida de Clerk |
| [`ehr-prescriptions/`](./ehr-prescriptions) | No implementado |
| [`billing/`](./billing) | No implementado |
| [`telehealth/`](./telehealth) | No implementado |

## Quick start

```bash
pnpm install                              # instala ambos workspaces
pnpm --filter identity-patient dev        # app principal (puerto 3000)
pnpm --filter notification dev            # servicio de mail (puerto 3009)
```

Requiere [pnpm](https://pnpm.io) instalado (`npm install -g pnpm` o `corepack enable`).
