# SaaS-EasyHealth

Repo meta de un SaaS de salud pensado como microservicios. Este repositorio
no tiene código — es el punto de referencia de la arquitectura completa
(HLD, decisiones cross-servicio, skills de Claude Code). Cada servicio con
código real vive en su propio repositorio.

Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle de arquitectura y
convenciones.

## Servicios

| Repositorio | Estado |
| --- | --- |
| [easyhealth-identity-patient](https://github.com/Linaressss073/easyhealth-identity-patient) | Next.js boilerplate (Clerk auth + multi-tenancy), sin adaptar al dominio aún |
| [easyhealth-notification](https://github.com/Linaressss073/easyhealth-notification) | Servicio de mail (Mailtrap) + webhook de bienvenida de Clerk |
| [`ehr-prescriptions/`](./ehr-prescriptions) | No implementado, sin repo propio todavía |
| [`billing/`](./billing) | No implementado, sin repo propio todavía |
| [`telehealth/`](./telehealth) | No implementado, sin repo propio todavía |
