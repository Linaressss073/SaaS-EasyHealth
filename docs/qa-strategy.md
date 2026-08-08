# QA Strategy: EasyHealth

## Version 1.0 | Last Updated: 2026-08-08 | Owner: Deivy Linares (único desarrollador)

> Generado con la skill `test-strategy` de
> [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills).
> `team_maturity: startup` — un solo desarrollador (con Claude Code como
> pair programmer), sin rol de QA dedicado, presupuesto $0 (solo capas
> gratuitas). Complementa `qa/requisitos-calidad-gherkin.md` (criterios de
> aceptación por requisito) — este documento define **cómo** se prueba el
> sistema en conjunto, no **qué** debe cumplir cada RF individual.

### 1. Executive Summary

EasyHealth es un sistema de información hospitalaria web (consulta
externa, agendamiento, farmacia, mesa de ayuda) construido como 8 servicios
(7 backends NestJS/Postgres + 1 frontend Next.js) sobre un documento de
requisitos formal (RF-01 a RF-47, RN-01 a RN-09, RNF-01 a RNF-15 — ver
`proyecto-1.docx.pdf` y `qa/requisitos-calidad-gherkin.md`). Hoy existen 45
tests unitarios repartidos en los 8 repos, **todos de un mismo tipo**:
funciones puras de reglas de negocio extraídas explícitamente para poder
probarlas sin levantar Postgres (vigencia de fórmula, antelación de
cancelación, prioridad de turnos). No existe ninguna prueba de integración
ni end-to-end. La auditoría de código que originó este documento ya
encontró dos bugs de concurrencia reales que ningún test actual habría
atrapado (dispensación doble de inventario, doble asignación de ticket —
ver `qa/requisitos-calidad-gherkin.md` §5). Objetivo de esta estrategia:
pasar de "unit tests aislados que prueban que la lógica es correcta en el
papel" a "confianza real de que el flujo clínico completo funciona", con
el mínimo de infraestructura que un equipo de una persona puede sostener.

### 2. Scope & Objectives

**En alcance:** los 8 servicios del sistema (`identity-patient`,
`notification`, `scheduling`, `checkin`, `ehr-prescriptions`, `pharmacy`,
`helpdesk`, `telehealth`), sus 7 roles de usuario, y los tres tipos de
prueba funcional, de integración y de control de acceso que ya exige el
documento original (§16, fase 9), ampliados con usabilidad, accesibilidad
y concurrencia (`qa/requisitos-calidad-gherkin.md` §6). Navegador de
referencia: Chrome/Edge de escritorio y un Android de gama media (RNF-06
re-especificado).

**Fuera de alcance por ahora:** pruebas de carga a escala real (no hay
usuarios reales todavía — se define umbral de reactivación en §12), test
de penetración formal (se cubre superficialmente vía `security-testing`
más adelante, no en esta fase), `telehealth` (fuera del alcance del
documento académico, sin frontend construido todavía).

**Objetivos medibles (próximos 2 trimestres):**
1. Cubrir con integration tests los 3 puntos de concurrencia identificados
   como bug confirmado o riesgo real (agendamiento, dispensación,
   asignación de tickets) antes de la entrega académica.
2. Tener al menos 8 E2E críticos (uno por rol, cubriendo su flujo
   principal) corriendo en CI antes del primer deploy a producción real.
3. Elevar la tasa de escape de defectos de "desconocida" (hoy solo hay
   pruebas manuales del propio desarrollador) a medible vía UAT por rol
   (`qa/requisitos-calidad-gherkin.md` §6) antes del cierre del proyecto.

### 3. Test Levels & Types

| Nivel | Qué valida | Dueño | Framework | Volumen objetivo | Frecuencia |
|---|---|---|---|---|---|
| **Unit** | Reglas de negocio puras (RN-05, RN-07, vigencia de fórmula, prioridad de turnos) | Desarrollador | Vitest | 60-70% del total | Cada commit |
| **Integration** | Guards de auth (Clerk→authz interno), llamadas entre servicios, transacciones de Postgres, condiciones de carrera | Desarrollador | Vitest + Testcontainers (Postgres real) | 20-25% del total | Cada PR |
| **E2E** | Los 8 flujos críticos por rol, de punta a punta contra los servicios reales | Desarrollador | Playwright | 10-15% del total, ~8-12 specs | Antes de cada deploy |
| **API/contrato** | Que cada NestJS controller respeta su DTO Zod y sus permisos declarados | Desarrollador | Supertest | Por endpoint sensible (mutaciones) | Cada PR |
| **Control de acceso** | RNF-03 + RNF-12: el backend rechaza lo que la UI ya oculta | Desarrollador | Vitest/Supertest, matriz rol×endpoint | Por permiso | Cada PR |
| **Accesibilidad** | RNF-14/15: contraste, formularios críticos con lector de pantalla | Desarrollador | axe-core (vía Playwright) | Pantallas de agendamiento, admisión, consulta | Nightly / pre-deploy |

No se adopta visual regression, chaos engineering ni contract testing
(Pact) en esta fase — sobredimensionado para un solo servicio consumidor
por integración y sin usuarios reales todavía. Se reevalúan en la revisión
de §12.

### 4. Test Pyramid Analysis

**Estado actual (medido en el código, 2026-08-08):**

```
Distribución actual de tests automatizados:
  Unit:        45 tests  →  100%
  Integration:  0 tests  →    0%
  E2E:          0 tests  →    0%
  Manual:      todo el resto — un solo tester (el desarrollador)

Forma actual: [x] Ninguna (no hay pirámide — solo hay base, sin cuerpo)

CI Pipeline Duration: ~2-3 min por repo (build + lint + types + unit)
Flaky Test Rate:      0% (nada corre todavía en un entorno compartido)
Test Suite Pass Rate: 100% (los 45 tests existentes pasan)
```

Esto no es un "cono invertido" (el patrón típico que esta skill
diagnostica) — es el caso contrario y menos común: una base sólida de
unit tests bien dirigidos a la lógica de negocio más riesgosa, pero sin
nada por encima que valide que los servicios realmente se hablan entre sí
o que un usuario puede completar un flujo real. Los dos bugs de
concurrencia confirmados en `qa/requisitos-calidad-gherkin.md` §5 son
exactamente el tipo de defecto invisible para unit tests y visible solo
en integración.

**Estado objetivo (fin de Fase 2, ver §11):**

```
Target Test Distribution:
  Unit:        60-70%  → ~70 tests (crecimiento orgánico, no forzado)
  Integration: 20-25%  → ~20-25 tests
  E2E:         10-15%  → ~10-12 tests

Target CI Duration: < 8 minutos por repo (con Testcontainers)
Target Flaky Rate:  < 5% (tolerancia más alta que un equipo grande —
                     sin presupuesto para infraestructura anti-flake)
```

**Plan de acción:**
1. No tocar la capa unit existente — es el activo más sano del proyecto,
   seguir el mismo patrón (función pura + spec + import en el service).
2. Agregar integration tests primero donde ya se confirmó un bug real
   (dispensación, asignación de tickets) — no partir de cero eligiendo
   módulos al azar.
3. Elegir Testcontainers (Postgres real efímero) en vez de mockear
   Drizzle — los bugs encontrados son de concurrencia a nivel de fila,
   un mock nunca los va a reproducir.
4. E2E recién después de tener integration tests de los flujos de
   escritura críticos — evita que el primer E2E se convierta en el único
   test que prueba lógica de negocio (síntoma de cono invertido).

### 5. Risk Assessment

Matriz 5×5 (Impacto × Probabilidad) aplicada a las áreas reales del
sistema:

| Área | Impacto | Probabilidad | Score | Nivel | Enfoque de prueba |
|---|---|---|---|---|---|
| Inmutabilidad de la historia clínica (RN-03) | 5 - Catastrófico | 2 - Improbable | 10 | HIGH | Integration test que verifique que `PATCH /consultas/:id` falla tras cierre; auditoría legal-adyacente |
| Dispensación de inventario (RF-28, bug confirmado) | 5 - Catastrófico | 4 - Probable | 20 | CRIT | Integration test de concurrencia + fix de bloqueo optimista antes que cualquier otra cosa |
| Auth/permisos por rol (RNF-03/RNF-12) | 5 - Catastrófico | 2 - Improbable | 10 | HIGH | Matriz rol×endpoint automatizada, un test por combinación sensible |
| Doble reserva de cita (RF-19) | 4 - Mayor | 1 - Raro (ya mitigado por unique index) | 4 | LOW | Ya cubierto por constraint de DB — solo un test de regresión |
| Asignación de tickets (RF-42, bug confirmado) | 2 - Menor | 4 - Probable | 8 | MED | Integration test + fix con `WHERE estado = 'abierto'` |
| Notificaciones (RF-22/32/44, sin reintento) | 2 - Menor | 4 - Probable | 8 | MED | Test de que el fallo queda registrado (no de que el email llegue — eso es de Mailtrap) |
| Digiturno / pantalla pública (RF-08) | 2 - Menor | 2 - Improbable | 4 | LOW | Smoke E2E, sin profundizar |
| Telehealth (fuera de alcance del documento) | 1 - Negligible | 1 - Raro | 1 | LOW | Sin pruebas hasta que tenga frontend |

El CRIT (dispensación de inventario) y ambos HIGH deben tener integration
test antes de que este documento se considere "cumplido" para el ciclo
actual — ver criterios de salida en §8.

### 6. Environment Strategy

| Entorno | Propósito | Tipos de prueba | Datos | Disparador |
|---|---|---|---|---|
| **Local** | Feedback del desarrollador | Unit, integration (Testcontainers) | Sembrados/efímeros | Al guardar / `pnpm test` |
| **CI (GitHub Actions)** | Validación automatizada | Unit, integration, lint, type-check | Efímeros (Postgres del job) | Push / PR a cada uno de los 8 repos |
| **Staging** | *No existe todavía* — se crea en Fase 2 | E2E, control de acceso, accesibilidad | Datos de prueba tipo los 5 usuarios Clerk ya creados | Merge a `main` (antes del deploy real) |
| **Producción** | Monitoreo — *no hay deploy real activo todavía* | Smoke tests | Datos reales | Deploy manual (Railway/Vercel) |

Hoy los 8 `ci.yml` ya gatean `build → static (lint+types) → unit → deploy`
(ver `easyhealth-scheduling/.github/workflows/ci.yml` como referencia) —
el job `deploy` corre solo si los anteriores pasan. Falta agregar el job
`integration` a esa cadena, y crear el entorno de staging antes de que
E2E tenga sentido.

### 7. Tool Selection Rationale

| Criterio (peso) | Vitest + Testcontainers | Playwright | Cypress |
|---|---|---|---|
| Encaja con el stack (25%) | 5 — mismo runner que ya usan los 45 unit tests | 4 — Next.js lo soporta de fábrica | 3 |
| Familiaridad del equipo (20%) | 5 — ya en uso en los 8 repos | 3 — nuevo, pero API simple | 2 |
| Comunidad y docs (15%) | 4 | 5 | 4 |
| Integración con CI (15%) | 5 — ya corre en GitHub Actions | 4 | 4 |
| Costo de mantenimiento (10%) | 4 | 4 | 3 — flaky histórico conocido |
| Velocidad de ejecución (10%) | 4 | 4 | 3 |
| Costo de licencia (5%) | 5 — gratis | 5 — gratis | 5 — gratis |
| **Total ponderado** | **4.55** | **4.05** | **3.15** |

**Decisión:** Vitest (ya adoptado) + Testcontainers para integración,
Playwright para E2E. Playwright gana sobre Cypress por soporte nativo de
múltiples pestañas/orígenes (relevante: el frontend en `localhost:3000`
llama a 6 servicios en otros puertos) y por ser el default de facto en
proyectos Next.js.

**Costo total de propiedad real para un equipo de 1 persona:** el mayor
costo no es licencia (todo gratis) sino tiempo de configuración de
Testcontainers en Windows (Docker Desktop ya es una dependencia nueva) y
tiempo de escritura de los primeros E2E. Se presupuesta explícitamente en
el timeline (§11) en vez de asumir que "sale gratis" solo porque las
herramientas lo son.

### 8. Entry/Exit Criteria

**Unit** — Entrada: la función de regla de negocio está extraída como
función pura (mismo patrón que `vigencia-formula.ts`/`turno-priority.ts`).
Salida: casos borde cubiertos (visto en la auditoría: el caso "solo hay
prioritarios en espera" de RN-05 sí está probado; verificar que todo RN
nuevo siga el mismo estándar).

**Integration** — Entrada: Postgres real vía Testcontainers disponible en
CI; unit tests del mismo módulo en verde. Salida: los 3 casos de
concurrencia de §5 (CRIT + 2 HIGH/MED) tienen un test que falla en `main`
hoy y debe pasar tras el fix — es decir, se escribe el test *antes* del
fix, no después, para confirmar que reproduce el bug real.

**E2E** — Entrada: entorno de staging desplegado, integration tests en
verde, usuarios Clerk de prueba provisionados (los 5 ya creados esta
sesión). Salida: los 8 flujos críticos por rol pasan sin intervención
manual; ningún defecto CRIT/HIGH abierto (ver §5) bloquea el flujo que
cubre.

**Release** — Entrada: los tres niveles anteriores en verde, sin
defectos CRIT/HIGH abiertos. Salida: smoke test post-deploy pasa,
ventana de observación de 30 minutos sin anomalías en logs, plan de
rollback verificado (hoy: `git revert` + redeploy — no hay blue/green).

### 9. Quality Gates & Definition of Done

**Gate de PR** (cada uno de los 8 repos, ya existe parcialmente): unit
tests pasan; lint sin errores nuevos; type-check limpio; **falta
agregar:** integration tests pasan; cobertura no disminuye.

**Gate de merge a `main`** (ya existe): los checks de PR pasan + el job
`deploy` gateado ya usado (`needs: [build, static, unit]`) — **falta
agregar** `integration` a esa lista de `needs`.

**Gate de deploy** (*no existe todavía* — no hay staging): E2E completo
en staging, sin defectos CRIT/HIGH abiertos, escaneo de dependencias
(`pnpm audit` o Dependabot, ya disponible gratis en GitHub) sin
vulnerabilidades críticas.

**Gate nocturno** (*no existe todavía*): E2E completo + axe-core en las
4 pantallas críticas (agendamiento, admisión, consulta, farmacia).

### 10. Metrics & KPIs

| Métrica | Definición | Objetivo | Frecuencia |
|---|---|---|---|
| Cobertura de código | Líneas/ramas cubiertas por unit + integration | >70% en `scheduling`, `pharmacy`, `checkin` (las áreas CRIT/HIGH de §5); >50% general | Por PR |
| Ratio de la pirámide | Unit:Integration:E2E | 65:22:13 (±10%) | Mensual |
| Tasa de flakiness | % de corridas con fallos no determinísticos | <5% (tolerancia alta — sin presupuesto para anti-flake infra) | Semanal |
| Tasa de escape de defectos | % de defectos hallados después del UAT por rol vs. total | <10% (baseline, sin dato histórico) | Por entrega académica |
| Duración de CI | Push a resultado verde/rojo, por repo | <8 min con integration incluida | Semanal |
| Bugs de concurrencia confirmados sin fix | Cuenta directa de §5 | 0 antes de la entrega | Continuo |
| Cobertura de accesibilidad | Violaciones axe-core nivel crítico/serio en pantallas clave | 0 | Nightly una vez exista el job |

### 11. Timeline & Milestones

**Fase 1 — Fundación (semanas 1-3):** Testcontainers configurado en
`easyhealth-pharmacy`, `easyhealth-scheduling`, `easyhealth-helpdesk`
(las 3 áreas de §5); un integration test por bug de concurrencia
confirmado (falla hoy, documenta el bug); fix de los 3 bugs;
`references: qa/requisitos-calidad-gherkin.md §5`. *Salida: los 3
escenarios "bug confirmado, sin corregir" de la adenda Gherkin pasan a
"resuelto".*

**Fase 2 — Ampliación (semanas 4-8):** entorno de staging (Railway/Vercel
con datos de prueba); Playwright configurado en `identity-patient`; 8 E2E
críticos (uno por rol); job `integration` agregado a los 8 `ci.yml`.
*Salida: los 8 flujos de rol tienen E2E en verde en CI.*

**Fase 3 — Accesibilidad y UAT (semanas 9-11):** axe-core en las 4
pantallas críticas; corrección de los hallazgos de RNF-14/15
(`<label>` en vez de solo `placeholder`, ver adenda §4); UAT por rol
(`qa/requisitos-calidad-gherkin.md` §6) con al menos un representante de
cada uno de los 7 roles. *Salida: 0 violaciones axe-core críticas/serias;
7 firmas de UAT, una por rol.*

**Continuo:** revisión trimestral de esta estrategia (siguiente:
2026-11-08); métricas de §10 revisadas junto con cada entrega académica.

### 12. Risks to the Strategy Itself

- **Un solo ejecutor.** Toda esta estrategia depende de una persona
  (más el pair programming con Claude Code). Si esa persona se
  desconecta del proyecto, no hay backup — mitigación: mantener
  `qa/requisitos-calidad-gherkin.md` y este documento actualizados es la
  única forma de que alguien más pueda retomarlo.
- **Sin usuarios reales todavía.** Los objetivos de §10 (tasa de escape,
  flakiness) no tienen baseline histórico real — se reevalúan con datos
  reales en cuanto haya un primer deploy a producción con tráfico, no se
  toman como verdad hasta entonces.
- **Docker Desktop como dependencia nueva.** Testcontainers requiere
  Docker corriendo localmente y en el runner de CI (GitHub Actions lo
  soporta nativo) — si en algún punto se cambia de CI provider, esto hay
  que reverificar.
- **Alcance académico vs. alcance de producto real.** Esta estrategia
  está calibrada para cerrar la entrega universitaria (RF-01 a RF-47 +
  adenda de calidad) — si el proyecto sigue como SaaS real después, la
  Fase 4 (visual regression, contract testing, chaos engineering,
  performance a escala) que hoy se descarta explícitamente en §3 debe
  reevaluarse, no asumirse como innecesaria para siempre.

### 13. Revision History

| Versión | Fecha | Autor | Cambios |
|---|---|---|---|
| 1.0 | 2026-08-08 | Deivy Linares (con Claude Code) | Versión inicial, generada con la skill `test-strategy`, a partir de la auditoría de código que produjo `qa/requisitos-calidad-gherkin.md` |

**Próxima revisión programada:** 2026-11-08 (trimestral), o antes si:
se agrega una nueva área de producto (ej. `telehealth` gana frontend),
cambia la composición del equipo, o se confirma un nuevo defecto de
severidad CRIT en producción.
