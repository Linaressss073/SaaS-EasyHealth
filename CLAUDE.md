# CLAUDE.md

## Resumen del proyecto

EasyHealth es un sistema de información hospitalaria web para consulta
externa (agendamiento, admisión/digiturno, consulta médica, farmacia,
mesa de ayuda), construido sobre un documento de requisitos formal —
`proyecto-1.docx.pdf`, RF-01 a RF-47, RN-01 a RN-09, RNF-01 a RNF-15 (las
RN/RNF por encima de 07/11 vienen de la adenda de calidad, ver
[`qa/requisitos-calidad-gherkin.md`](./qa/requisitos-calidad-gherkin.md)).
Un solo desarrollador, con Claude Code como pair programmer, presupuesto
$0 (solo capas gratuitas de cada proveedor).

**Este repositorio es el repo "meta"**: documentación, decisiones
cross-servicio, estrategia de QA y skills de Claude Code — no tiene código
de ningún servicio. Cada microservicio con código real vive en su propio
repositorio de GitHub, listados en la sección siguiente.

> Este documento reemplaza una versión anterior que describía un plan de
> 5 microservicios sobre MongoDB — ese plan se descartó a mitad de sesión
> a favor de lo que sigue: Postgres/Drizzle por continuidad con
> `identity-patient`, NestJS para los servicios nuevos, y 8 servicios
> reales (no 5) porque el documento académico exige más superficie de la
> que cubría el objetivo original del SaaS personal.

## Mapa de servicios

| Servicio | Puerto local | RFs que cubre | Rol |
|---|---|---|---|
| [easyhealth-identity-patient](https://github.com/Linaressss073/easyhealth-identity-patient) | 3000 | RF-33 a RF-39 (usuarios/roles/auditoría) + **todo el frontend** | Next.js — único frontend del sistema, autenticación (Clerk), autorización de dominio, auditoría |
| [easyhealth-scheduling](https://github.com/Linaressss073/easyhealth-scheduling) | 3001 | RF-18 a RF-24 | NestJS — especialidades, profesionales, agendas, citas |
| [easyhealth-checkin](https://github.com/Linaressss073/easyhealth-checkin) | 3002 | RF-01 a RF-10 | NestJS — admisión y digiturno |
| [easyhealth-ehr-prescriptions](https://github.com/Linaressss073/easyhealth-ehr-prescriptions) | 3003 | RF-11 a RF-17 | NestJS — consulta médica, historia clínica, fórmulas y órdenes |
| [easyhealth-pharmacy](https://github.com/Linaressss073/easyhealth-pharmacy) | 3004 | RF-25 a RF-32 | NestJS — recepción de fórmulas, inventario, dispensación |
| [easyhealth-helpdesk](https://github.com/Linaressss073/easyhealth-helpdesk) | 3005 | RF-40 a RF-47 | NestJS — mesa de ayuda, base de conocimiento |
| [easyhealth-telehealth](https://github.com/Linaressss073/easyhealth-telehealth) | 3006 | Fuera del documento — agregado a pedido explícito | NestJS — sesiones de telemedicina, sin frontend todavía |
| [easyhealth-notification](https://github.com/Linaressss073/easyhealth-notification) | 3009 | Soporte de RF-22/32/44 | Next.js (solo API routes) — envío de correo vía Mailtrap |

Los 6 servicios NestJS comparten una única instancia de Postgres en Render
(límite del free tier: una instancia activa), separados en bases de datos
lógicas distintas (`db_scheduling`, `db_checkin`, `db_ehr_prescriptions`,
`db_pharmacy`, `db_helpdesk`, `db_telehealth`). `identity-patient` tiene su
propia base (boilerplate original). `notification` no tiene base de
datos — es deliberadamente stateless.

## Cómo se autentican y autorizan las requests

Todo el sistema comparte un mismo mecanismo, sin importar el servicio:

1. **Identidad**: Clerk. El usuario inicia sesión una sola vez en
   `identity-patient` (único frontend). Cada request a un microservicio
   NestJS reenvía el JWT de sesión de Clerk como `Authorization: Bearer`
   (ver `src/libs/ServiceClient.ts` en `identity-patient` — la función
   `callService()` que usa toda página del dashboard).
2. **Verificación de identidad**: cada NestJS trae su propio
   `ClerkAuthGuard` (`src/common/auth/clerk-auth.guard.ts`, duplicado en
   cada repo — ver "Convenciones" más abajo) que usa `@clerk/backend` para
   verificar el JWT y extraer `clerkUserId`/`clerkOrgId`.
3. **Resolución de roles/permisos**: los 7 roles clínicos (`paciente`,
   `agendador`, `admisionista`, `medico`, `farmaceutico`,
   `agente_soporte`, `administrador`) y sus permisos **viven únicamente**
   en la base de `identity-patient` (tablas `usuario`/`usuario_rol`/`rol`).
   Ningún otro servicio los replica. El guard de cada NestJS llama a
   `POST /api/internal/authz` en `identity-patient` (protegido con el
   secreto compartido `INTERNAL_API_SECRET`, nunca con el JWT de Clerk —
   es servicio-a-servicio) para resolver `{ activo, roles, permissions }`,
   y expone un decorator `@RequirePermission('permiso')` por endpoint.
4. **Auditoría**: cualquier operación sensible llama a
   `POST /api/internal/audit` en `identity-patient` (mismo secreto
   compartido), que inserta en `log_auditoria` — RF-38/39.
5. **Interfaz filtrada por rol** (RNF-12, ver adenda de calidad): además
   de que el backend rechace lo que no corresponde, `identity-patient`
   oculta del menú y redirige con una pantalla 403 propia
   (`src/app/[locale]/forbidden.tsx`) cualquier función fuera del rol —
   el backend sigue siendo la autoridad final, la UI es la primera línea.

**Nunca hay roles/permisos embebidos en el JWT de Clerk** — no existe JWT
template ni custom claims. Se resuelven en cada request contra la base de
`identity-patient`, con un caché corto en memoria por servicio para no
pegarle a `identity-patient` en cada request de una ráfaga.

## Mensajería asíncrona: QStash

El único flujo genuinamente asíncrono del sistema es RF-25 ("recibir
automáticamente las fórmulas generadas en consulta, sin intervención
manual"). Se implementa con **Upstash QStash** (HTTP-based, no Kafka —
Upstash discontinuó su oferta de Kafka en marzo de 2025, se descubrió a
mitad de sesión vía captura de pantalla del propio usuario):

- `easyhealth-ehr-prescriptions` publica vía `QStashPublisherService`
  (`@upstash/qstash` `Client.publishJSON`) al endpoint público de
  `easyhealth-pharmacy`.
- `easyhealth-pharmacy` expone `POST /qstash/formula-generada`, verifica
  la firma `Upstash-Signature` con `Receiver.verify()` (requiere
  `rawBody: true` en `NestFactory.create()`), y **falla cerrado** (503) si
  las signing keys no están configuradas — es el único endpoint del
  sistema alcanzable desde internet sin pasar por Clerk, así que no puede
  degradar silenciosamente como el resto.
- Todo lo demás (checkin validando la cita del día contra scheduling,
  ehr-prescriptions leyendo la cola de admitidos contra checkin,
  cualquier servicio disparando un correo contra notification) es **REST
  síncrono directo** — no se fuerza asincronía donde no aporta desacople
  real.

## Cada microservicio en detalle

### easyhealth-identity-patient (frontend + identidad)

El único frontend del sistema (Next.js App Router, 100% Server Components
+ Server Actions, sin fetching de cliente). Originado del boilerplate
[ixartz/SaaS-Boilerplate](https://react-saas.com) (Clerk + Drizzle ya
integrados), adaptado al dominio con:

- **Módulos de dashboard**: Citas (agendamiento), Admisión, Consultas
  (consulta médica + fórmulas + órdenes), Farmacia (dispensación +
  inventario), Soporte (mesa de ayuda), Agenda y catálogo (admin),
  Usuarios/Auditoría (admin) — cada uno reenviando requests a su
  microservicio correspondiente vía `callService()`.
- **`src/libs/ServiceClient.ts`**: `callService()` (con sesión, reenvía
  el JWT) y `callPublicService()` (sin sesión, para el único endpoint
  genuinamente público del sistema: la pantalla de turno,
  `/pantalla-turnos`, sin login — RF-08).
- **Endpoints internos** (`/api/internal/*`, protegidos con
  `INTERNAL_API_SECRET`): `authz` (resuelve roles/permisos),
  `audit` (registra en `log_auditoria`), `pacientes/buscar`,
  `pacientes/actualizar-contacto`, `pacientes/por-clerk-id` — estos tres
  últimos permiten que `checkin`, `pharmacy` y otros resuelvan datos de
  paciente sin tener su propia tabla `paciente`.
- **`src/app/[locale]/forbidden.tsx`**: pantalla 403 propia (RNF-12).
- **`design-system/easyhealth/MASTER.md`**: guía de estilo (paleta,
  tipografía, checklist de accesibilidad) generada con la skill
  `ui-ux-pro-max` para el rubro Healthcare — referencia de consistencia,
  no un requisito nuevo.

### easyhealth-scheduling (RF-18 a RF-24)

Entidades propias: `especialidad`, `profesional`,
`profesional_especialidad`, `agenda` (plantilla semanal recurrente),
`cita`, `lista_espera`.

- `GET/POST /especialidades`, `GET/POST /profesionales`,
  `GET /profesionales/:id/agenda`, `POST /agendas` — catálogo y
  parametrización de agenda, solo Administrador (RF-23).
- `GET /disponibilidad` — calcula slots libres de una plantilla de agenda
  menos las citas ya tomadas.
- `POST /citas`, `PATCH /citas/:id/reprogramar`,
  `POST /citas/:id/cancelar`, `GET /citas/mias` — RF-19/20/21. La
  cancelación exige 24h de antelación cuando la hace el propio paciente
  (RN-07), y libera la franja para la lista de espera (RF-24).
- `POST /lista-espera` — RF-24.
- No permite doble reserva de la misma franja: `uniqueIndex` en Postgres
  sobre `(profesionalId, fecha, horaInicio)`, capturado como 409 — es el
  único de los tres puntos de concurrencia auditados que ya estaba bien
  resuelto desde el diseño original (ver adenda de calidad §5).

### easyhealth-checkin (RF-01 a RF-10)

Entidad propia: `turno` (no tiene tabla `paciente` ni `cita` — las
referencia por ID, viven en otros servicios/bases).

- `POST /admision/buscar-paciente`, `.../actualizar-contacto`,
  `.../citas-del-dia`, `.../llegada` — RF-01 a RF-05, llama a
  `identity-patient` para los datos del paciente y a `scheduling` para
  validar la cita del día.
- `GET /turnos/publico` — sin autenticación, RF-08 (pantalla pública).
- `GET /turnos/mio` — turno propio del día, para que el frontend resuelva
  RF-09 sin conocer de antemano el `turnoId`.
- `POST /turnos/siguiente` (RF-12, con la regla de intercalado RN-05 —
  ver `turno-priority.ts`), `POST /turnos/:id/rellamar` (RF-10, exige 60s
  mínimos entre llamados, marca "No asistió" al tercero — ver
  `rellamado-turno.ts`), `GET /turnos/:id/posicion` (RF-09).

### easyhealth-ehr-prescriptions (RF-11 a RF-17)

Entidades propias: `consulta` (inmutable una vez cerrada — RN-03),
`diagnostico_cie10`, `orden_medica`, `formula`, `detalle_formula`.

- `GET /agenda-del-dia` — RF-11, lee la cola de turnos de `checkin`.
- `POST /consultas`, `PATCH /consultas/:id` (bloqueado si `cerrada`),
  `GET /consultas/:id`, `GET /consultas/historico` (**debe** registrarse
  antes que `:id` en el controller — si no, Express matchea `:id` contra
  el literal `"historico"`), `POST /consultas/:id/notas` (notas
  aclaratorias, única edición permitida tras el cierre), `POST
  /consultas/:id/formula`, `POST /consultas/:id/ordenes`, `POST
  /consultas/:id/cerrar` (RF-16, cambia la cita a Finalizada vía
  `scheduling`).
- Publica a QStash cuando se genera una fórmula (ver sección de
  mensajería).

### easyhealth-pharmacy (RF-25 a RF-32)

Entidades propias: `medicamento`, `inventario` (por lote, con
vencimiento), `movimiento_inventario`, `formula_recibida`,
`detalle_formula_recibida`.

- `POST /qstash/formula-generada` — RF-25, consumer de QStash (ver
  mensajería).
- `GET /formulas/pendientes`, `GET /formulas/:id`, `POST
  /formulas/:id/dispensar` — RF-26/27/28. Dispensación FEFO (primero el
  lote más próximo a vencer); soporta parcial (RF-28), el remanente queda
  `pendiente_por_faltante` indefinidamente hasta que se complete o venza
  la vigencia de la fórmula (`fechaExpedicion + vigenciaDias`, chequeado
  antes de cada dispensación).
- `GET/POST /medicamentos` — RF-29. `POST /inventario/entradas`, `GET
  /inventario/alertas/stock-bajo`, `GET
  /inventario/alertas/proximos-a-vencer` — RF-30/31.
- **Bloqueo optimista en la dispensación** (RN-09, ver adenda de
  calidad): tanto el descuento de inventario como la marca de "línea
  dispensada" usan `UPDATE ... WHERE <condición esperada>` con
  verificación de la fila devuelta, no lectura-y-escritura — corrige un
  bug de concurrencia real confirmado en auditoría (dos dispensaciones
  simultáneas del mismo lote podían descontar el stock dos veces).

### easyhealth-helpdesk (RF-40 a RF-47)

Entidades propias: `ticket`, `respuesta_ticket`, `base_conocimiento`.

- `POST /tickets`, `GET /tickets/mios` — RF-40/41/45, cualquier usuario
  autenticado (no requiere permiso de rol).
- `GET /tickets` (bandeja del agente, todos los tickets — agregado
  durante la corrección de fallos, no existía originalmente), `GET
  /tickets/:id`, `POST /tickets/:id/asignar` (RF-42, **bloqueo
  optimista**: `WHERE estado = 'abierto'`, rechaza con 409 si otro agente
  ya lo tomó — corrige otro bug de concurrencia confirmado en auditoría),
  `POST /tickets/:id/responder` (RF-43, puede cambiar de estado en el
  mismo request), `POST /tickets/:id/reabrir` (solo el solicitante, solo
  si estaba "resuelto").
- `GET /tickets/indicadores` — RF-46, volumen por categoría y tiempo
  promedio de resolución.
- `GET/POST /base-conocimiento` — RF-47.

### easyhealth-telehealth (fuera del documento académico)

Agregado a pedido explícito del usuario durante la sesión de arquitectura,
consciente de que el documento lo excluye (§5.2: "Telemedicina y
videoconsulta"). Entidad propia: `sesion_telemedicina`.

- `POST /` (crear sesión, vinculada a una cita de `scheduling`), `GET
  /mias`, `GET /:id`, `POST /:id/iniciar`, `POST /:id/finalizar`.
- Backend completo, **sin frontend todavía** — no hay pantallas en
  `identity-patient` para este servicio.

### easyhealth-notification (soporte a RF-22/32/44)

Deliberadamente el único servicio sin base de datos propia — Next.js con
solo API routes, pensado para correr en Vercel serverless (no puede
sostener un consumer de cola persistente, por eso todo lo dispara vía
HTTP directo, nunca vía QStash/Kafka).

- `POST /api/internal/send-cita-confirmada`, `.../send-formula-lista`,
  `.../send-ticket-actualizado` — cada microservicio de dominio llama a
  uno de estos tras la operación correspondiente (RF-22/32/44),
  protegidos con `INTERNAL_API_SECRET`.
- `POST /api/webhooks/clerk` — correo de bienvenida al crearse un usuario
  en Clerk (`user.created`).
- **`sendMail()`** (`src/libs/Mail.ts`) reintenta hasta 3 veces con
  backoff exponencial antes de fallar — agregado tras reproducir en vivo
  un rate-limit real del sandbox de Mailtrap (`550 Too many emails per
  second`) probando este mismo flujo. No hay bitácora persistente de
  fallas ni reenvío manual (RF-48 solo parcialmente cubierto): este
  servicio se mantiene stateless a propósito, así que una bitácora
  duradera requiere decidir primero si suma una base de datos propia —
  ver `qa/qa-strategy.md` para el detalle de esa decisión pendiente.

## Convenciones que se repiten en cada repo de servicio

Documentado acá porque aplica a todos, pero vive configurado en cada repo
individual (no hay nada compartido/publicado como paquete):

- Stack base (Next.js): TypeScript strict, App Router, pnpm, Vitest,
  ESLint con Antfu config, T3 Env (nunca `process.env` directo).
- Stack base (NestJS, los 6 servicios de dominio): TypeScript strict,
  pnpm, Vitest, ESLint Antfu (con `'ts/consistent-type-imports': 'off'` —
  el auto-fixer de esa regla rompe la inyección de dependencias de Nest
  al convertir imports de clase a `import type`, que TypeScript borra
  antes de que `emitDecoratorMetadata` pueda verlos), Drizzle + Postgres,
  validación de env con Zod vía `@nestjs/config`
  (`ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] })` — el
  default de Nest solo lee `.env`, hay que declarar `.env.local`
  explícito).
- Cada NestJS trae su propio `common/auth/` (`ClerkAuthGuard`,
  `RequirePermission`, `InternalSecretGuard`, `AuditService`) — duplicado
  por repo a propósito, mismo criterio que `commitlint.config.ts` /
  `lefthook.yml`. Si el catálogo de permisos cambia en
  `identity-patient/src/libs/Permissions.ts`, hay que replicarlo a mano
  en cada `common/auth/permissions.ts`.
- Reglas de negocio no triviales se extraen como funciones puras
  testeables sin levantar Postgres (`vigencia-formula.ts`,
  `antelacion-cancelacion.ts`, `turno-priority.ts`,
  `rellamado-turno.ts`) — patrón establecido desde el primer servicio,
  replicado consistentemente.
- Commits: Commitlint + Commitizen. Git hooks con Lefthook (`lint` →
  `check-types` → `knip` secuencial, invocando binarios de
  `node_modules/.bin/` directo, no vía `pnpm run`).
- CI/CD: un `ci.yml` por repo (`build` → `static` → `unit` → `deploy`
  gateado, `needs: [build, static, unit]`). Los 6 NestJS despliegan a
  Railway; `identity-patient` y `notification` a Vercel.
- `drizzle/meta/` (journal + snapshots) **debe** estar trackeado en git —
  se perdió por un `.gitignore` mal copiado en los 6 repos nuevos, ya
  corregido.

## Estado de la calidad — documentos relacionados

- [`qa/requisitos-calidad-gherkin.md`](./qa/requisitos-calidad-gherkin.md)
  — adenda de requisitos con criterios de aceptación medibles en formato
  Gherkin, producto de una auditoría de QA/UI-UX sobre el sistema ya
  construido (RBAC de interfaz, estados de UI faltantes, accesibilidad,
  concurrencia, fase de pruebas ampliada).
- [`docs/qa-strategy.md`](./docs/qa-strategy.md) — estrategia de pruebas
  (pirámide, entorno, gates, métricas, timeline), calibrada para un
  equipo de una persona.
- La mayoría de los hallazgos de la adenda ya se corrigieron en el código
  real (dos bugs de concurrencia, confirmaciones en acciones
  irreversibles, labels de accesibilidad en formularios críticos, página
  403 propia, reintento de notificaciones) — lo que sigue pendiente está
  marcado explícitamente en cada documento, no hay que asumir que "está
  en la adenda" significa "sin resolver".

## Notas y advertencias

- **`easyhealth-telehealth` no tiene frontend.** Backend completo, cero
  pantallas en `identity-patient`.
- **No hay Dockerfile ni docker-compose en ningún servicio** — desarrollo
  local corre cada servicio directo con `pnpm dev`/`node dist/src/main.js`
  contra la misma instancia de Postgres de Render (bases lógicas
  separadas) y el mismo proyecto de Clerk.
- **Mailtrap está configurado y probado** con credenciales sandbox reales
  (no de producción — el sandbox nunca entrega a bandejas reales, solo a
  la inbox de prueba de Mailtrap).
- **`CLERK_WEBHOOK_SIGNING_SECRET` en `easyhealth-notification` es un
  placeholder** en `.env.local` — no se probó el flujo de webhook esta
  sesión, solo el envío de correo directo. Reemplazar antes de probar
  `user.created`.
