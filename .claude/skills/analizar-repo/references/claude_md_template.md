# Plantilla de CLAUDE.md

Esta es la estructura que debe tener el `CLAUDE.md` generado por la skill
`/analizar-repo`. No es un formulario para llenar mecánicamente: cada sección
existe para responder una pregunta concreta que alguien (humano o Claude) se
haría al entrar por primera vez a este repo.

## Reglas generales

- **Evidencia sobre inferencia.** Cada afirmación debe poder rastrearse a algo
  que se leyó: un manifiesto, un archivo de código, un README. Si no se pudo
  confirmar algo, dilo explícitamente ("no se encontró configuración de CI")
  en vez de omitirlo o inventarlo.
- **Comandos reales, no genéricos.** Copiá los comandos tal como aparecen en
  `package.json`, `Makefile`, workflows de CI, etc. No asumas `npm test` solo
  porque es lo típico en un proyecto Node — usa el script que realmente existe.
- **Conciso.** Este archivo lo va a leer un modelo en cada sesión futura, no
  una persona hojeando documentación. Preferí listas cortas y directas sobre
  prosa larga. Si una sección no aplica al repo (por ejemplo no hay
  infraestructura), omítela en vez de dejarla vacía.
- **Sin relleno.** No repitas en texto lo que ya es obvio por la estructura de
  carpetas. No hace falta explicar qué es Docker o qué es un CLAUDE.md.

## Estructura

```markdown
# CLAUDE.md

## Resumen del proyecto

Qué hace este proyecto y para quién, en 2-4 líneas. Basado en el README o el
propósito evidente del código. Si no se puede determinar con confianza, decilo
en vez de inventar un propósito de negocio.

## Stack tecnológico

- Lenguaje(s):
- Framework(s) principal(es):
- Base de datos / ORM:
- Testing:
- Gestor de paquetes:
- Infraestructura (Docker, CI/CD, hosting si es evidente):

(Solo incluir lo que se confirmó via manifiestos o código — no asumir nada
por convención del framework.)

## Arquitectura

Patrón detectado (DDD/hexagonal, MVC, monorepo, feature-based, ad-hoc, etc.)
y por qué se identificó ese patrón (qué carpetas/estructura lo evidencian).
Incluir un mapa breve de las carpetas de primer/segundo nivel más relevantes
y qué vive en cada una — no un árbol completo, solo lo que orienta.

## Cómo correr el proyecto

Comandos reales, copiados de los manifiestos/scripts encontrados:

- Instalar dependencias:
- Levantar en desarrollo:
- Correr tests:
- Build de producción:
- Lint / formateo (si existe):

## Convenciones del equipo

Solo si están documentadas (CONTRIBUTING.md) o son evidentes por patrones
repetidos en el código: estilo de commits, branching, estructura de PRs,
convenciones de nombres, patrones de testing preferidos.

## Notas y advertencias

- Discrepancias entre la documentación (README, etc.) y lo que realmente hace
  el código, si las hay.
- Zonas del repo sin tests, sin documentación, o con dependencias inusuales
  que valga la pena que alguien revise antes de tocarlas.
- Cualquier cosa que haya sorprendido durante el análisis y que no encaje en
  las secciones anteriores.
```

## Qué hacer si algo no se pudo confirmar

No dejes la sección vacía ni la inventes. Escribí una línea explícita, por
ejemplo:

- "No se encontró configuración de CI/CD en el repo."
- "El README no menciona cómo correr los tests; no se encontró script de
  testing en `package.json` ni carpeta de tests reconocible."
- "El patrón de arquitectura no es claro — las carpetas no siguen una
  convención reconocible (ni por capa técnica ni por feature)."

Esto es más útil que un CLAUDE.md que parece completo pero tiene huecos
silenciosos.
