---
name: analizar-repo
description: Analiza un repositorio de código para entender su documentación, stack tecnológico, arquitectura y convenciones, y genera un archivo CLAUDE.md con ese contexto. Usa esta skill siempre que el usuario pida "analizar este repo", "entender este proyecto", "generar un CLAUDE.md", "documentar la arquitectura de este código", "onboardearme a este proyecto", explore un repositorio nuevo o clonado, o pida un resumen del stack/arquitectura de una carpeta de código — incluso si no menciona "CLAUDE.md" explícitamente y solo dice cosas como "no entiendo esta base de código" o "dame contexto de este repo antes de empezar a trabajar en él".
---

# Repo Analyzer

Esta skill le da a Claude (esta instancia u otra futura) contexto rápido y
confiable sobre un repositorio: qué tecnologías usa, cómo está organizado, y
cómo se corre. El resultado principal es un `CLAUDE.md` en la raíz del repo,
más un resumen corto en el chat para que el usuario lo revise sin tener que
abrir el archivo.

La razón de ser de esta skill es evitar dos fallos comunes: (1) adivinar el
stack por el nombre de las carpetas en vez de leer los manifiestos reales, y
(2) generar un CLAUDE.md genérico que no dice nada que no se pudiera adivinar
sin mirar el código. Todo lo que va en el CLAUDE.md debe estar respaldado por
algo que realmente se leyó.

## Flujo de trabajo

### 1. Ubicar el repositorio

Si el usuario no dio una ruta explícita, pregunta o infiere del contexto
(por ejemplo si ya está trabajando dentro de una carpeta). No asumas que es
el directorio actual sin confirmarlo si hay ambigüedad.

### 2. Detección determinista del stack

Corre el script de detección antes de leer nada a mano — te ahorra tiempo y
evita que te bases en suposiciones:

```bash
python scripts/detect_stack.py /ruta/al/repo
```

(la ruta al script depende de dónde esté instalada esta skill — usa la ruta
relativa a esta carpeta, por ejemplo `.../analizar-repo/scripts/detect_stack.py`).
Esto devuelve
JSON con: lenguajes, frameworks, testing, gestores de paquetes, infraestructura
(Docker, etc.), CI/CD, manifiestos encontrados, scripts de package.json, y un
árbol de directorios superficial ya filtrado (sin `node_modules`, `.git`, etc.).

Si el repo usa un stack que el script no reconoce (por ejemplo un lenguaje
poco común, o un monorepo con estructura rara), no te limites a lo que
devolvió — sigue explorando a mano con `view`/`bash` para completar el cuadro.
El script es un punto de partida rápido, no la fuente de verdad final.

### 3. Leer la documentación existente

Lee todo lo que haya en `docs_found` del resultado del script: README,
CONTRIBUTING, ARCHITECTURE.md, y cualquier cosa dentro de `docs/`. Presta
atención a:

- El propósito declarado del proyecto (para no tener que inventarlo)
- Comandos de instalación/build/test documentados
- Decisiones de arquitectura ya explicadas por el equipo
- Convenciones de contribución (branching, commits, code style)

Si el README está desactualizado respecto al código (pasa seguido), confía
más en el código/manifiestos y anota la discrepancia.

### 4. Entender la arquitectura real

Con el árbol de directorios como mapa, explora las carpetas de primer y
segundo nivel más relevantes (donde vive el código fuente, no configs
sueltos). Buscá patrones reconocibles:

- **DDD / arquitectura hexagonal**: carpetas tipo `domain/`, `application/`,
  `infrastructure/`, `presentation/`
- **MVC**: `models/`, `views/`, `controllers/`
- **Monorepo**: `packages/`, `apps/`, workspaces en el package.json raíz
- **Feature-based / vertical slicing**: carpetas por funcionalidad de negocio
  en vez de por capa técnica

No fuerces un patrón si no calza — es igual de válido documentar "no sigue un
patrón formal reconocible, la organización es ad-hoc por [criterio observado]".

### 5. Testing, CI/CD y cómo correr el proyecto

Del resultado del script (`testing`, `ci_cd`) más una revisión rápida de
`package.json` scripts / `Makefile` / workflows de CI, arma los comandos
reales para instalar, correr, testear y buildear. Copia los comandos tal cual
aparecen — no los inventes por convención del framework.

### 6. Generar el CLAUDE.md

Usa la plantilla en `references/claude_md_template.md` — léela antes de
escribir el archivo, define la estructura exacta y las reglas de cómo llenar
cada sección (evidencia sobre inferencia, comandos reales, qué hacer si algo
no se pudo confirmar). Escribe el archivo en la raíz del repositorio como
`CLAUDE.md`. Si ya existe un `CLAUDE.md`, no lo sobreescribas sin avisar —
muéstrale al usuario un diff o pregúntale si lo reemplaza, lo fusiona, o lo
deja en un archivo aparte para comparar.

### 7. Resumen corto para el chat

Después de generar el archivo, no le pegues el CLAUDE.md completo de vuelta
al usuario en el chat — eso es redundante. Dale un resumen de 4-6 líneas:
stack detectado, patrón de arquitectura, y cualquier cosa que te haya
sorprendido o que valga la pena que revise (discrepancias con el README,
dependencias raras, ausencia de tests, etc.). El archivo completo queda
disponible para que lo abra cuando quiera.

## Casos especiales

- **Repo muy grande / monorepo con múltiples servicios**: pregunta si el
  usuario quiere un CLAUDE.md general en la raíz, uno por servicio/paquete, o
  ambos, antes de generar todo automáticamente — puede ser mucho trabajo
  desperdiciado si no es lo que quería.
- **Repo sin ninguna documentación**: aumenta el peso de la exploración de
  código (paso 4) porque no hay README del que partir. Sé más conservador en
  el "Resumen del proyecto" — si el propósito de negocio no es evidente por
  el código, dilo en vez de inventarlo.
- **Repo con documentación desactualizada**: prioriza siempre lo verificable
  en el código/manifiestos por encima de lo que dice la documentación vieja,
  y menciona la discrepancia en "Notas y advertencias" del CLAUDE.md.
