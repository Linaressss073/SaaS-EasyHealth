# SaaS-EasyHealth

Repo meta de EasyHealth, un sistema de información hospitalaria web para
consulta externa, construido como 8 microservicios sobre un documento de
requisitos formal (RF-01 a RF-47). Este repositorio no tiene código — es
el punto de referencia de la arquitectura completa, la estrategia de QA y
las skills de Claude Code. Cada servicio con código real vive en su propio
repositorio.

Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle de arquitectura,
autenticación/autorización, mensajería y cada microservicio explicado.
Ver [`qa/requisitos-calidad-gherkin.md`](./qa/requisitos-calidad-gherkin.md)
y [`docs/qa-strategy.md`](./docs/qa-strategy.md) para calidad y pruebas.

## Servicios

| Repositorio | Puerto | Rol |
| --- | --- | --- |
| [easyhealth-identity-patient](https://github.com/Linaressss073/easyhealth-identity-patient) | 3000 | Frontend (Next.js) + identidad, roles, auditoría |
| [easyhealth-scheduling](https://github.com/Linaressss073/easyhealth-scheduling) | 3001 | Agendamiento de citas |
| [easyhealth-checkin](https://github.com/Linaressss073/easyhealth-checkin) | 3002 | Admisión y digiturno |
| [easyhealth-ehr-prescriptions](https://github.com/Linaressss073/easyhealth-ehr-prescriptions) | 3003 | Consulta médica, historia clínica, fórmulas |
| [easyhealth-pharmacy](https://github.com/Linaressss073/easyhealth-pharmacy) | 3004 | Farmacia: inventario y dispensación |
| [easyhealth-helpdesk](https://github.com/Linaressss073/easyhealth-helpdesk) | 3005 | Mesa de ayuda |
| [easyhealth-telehealth](https://github.com/Linaressss073/easyhealth-telehealth) | 3006 | Telemedicina (fuera del documento, sin frontend) |
| [easyhealth-notification](https://github.com/Linaressss073/easyhealth-notification) | 3009 | Envío de correo (Mailtrap) |
