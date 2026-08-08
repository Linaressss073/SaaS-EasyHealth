# Adenda de calidad — requisitos de aceptación (Gherkin)

> Complementa `proyecto-1.docx.pdf` (RF-01 a RF-47, RN-01 a RN-07, RNF-01 a
> RNF-11). No reemplaza el documento original: lo hace verificable. Cada
> hallazgo de esta adenda nace de una auditoría de QA/UI-UX sobre el sistema
> ya construido, no de una lectura teórica del documento — donde fue posible,
> los escenarios citan el archivo y la línea de código que confirman el
> comportamiento real (o su ausencia).
>
> `# language: es` — los `Feature`/`Scenario` de este documento usan
> palabras clave de Gherkin en español (`Característica`, `Escenario`,
> `Dado`, `Cuando`, `Entonces`, `Y`), tal como las reconoce Cucumber/Gherkin.

---

## 1. RBAC de interfaz ≠ RBAC de backend

**RNF-12 (nuevo — Usabilidad/Seguridad).** Cada rol accede a un menú y un
dashboard propios que solo exponen las opciones permitidas para ese rol.
Ningún usuario debe poder navegar ni descubrir accidentalmente una función
fuera de su alcance — ni por menú, ni por URL directa — aunque el backend ya
la bloquee (RNF-03 sigue siendo la autoridad final; esto es la capa que
evita que el usuario llegue a necesitarla).

Implementado parcialmente en `easyhealth-identity-patient` (commit
`186f509`): el menú principal solo muestra los módulos permitidos, y las
pantallas de administración (Usuarios, Auditoría, Agenda y catálogo,
Miembros, Configuración) viven en un dropdown "Administración" que
directamente no se renderiza si el usuario no tiene ningún permiso
administrativo. Falta el escenario 3 (acceso directo por URL) como prueba
automatizada.

```gherkin
Característica: Navegación filtrada por rol
  Como usuario del sistema
  Quiero ver solo las opciones que puedo usar
  Para no toparme con pantallas que no me corresponden ni descubrir
  funciones ajenas a mi rol

  Escenario: Un paciente no ve opciones de administración
    Dado que inicio sesión como usuario con rol "paciente" únicamente
    Cuando cargo el panel principal
    Entonces el menú muestra únicamente "Inicio", "Citas" y "Soporte"
    Y no existe en el DOM ningún enlace a "Usuarios", "Auditoría",
      "Agenda y catálogo" ni "Configuración"

  Escenario: Acceso directo por URL a una función fuera del rol
    Dado que inicio sesión como usuario con rol "paciente" únicamente
    Cuando navego directamente a la URL "/dashboard/agenda-admin"
      sin pasar por el menú
    Entonces el servidor responde con una página 403 propia del sistema
      (no la página 403 genérica de Next.js)
    Y la página 403 explica en lenguaje claro que la función requiere
      otro rol y sugiere a quién contactar
    Y no se expone en la respuesta ningún dato de especialidades,
      profesionales ni agendas

  Escenario: Usuario con múltiples roles ve la unión de sus menús
    # RF-34 permite asignar varios roles a una cuenta (ej. médico +
    # administrador). La resolución de permisos ya es una unión de
    # conjuntos (ver PERMISOS_POR_ROL / getUserPermissions en
    # easyhealth-identity-patient/src/libs/Authorization.ts) — no existe
    # ni se requiere un selector de "modo": el usuario ve, en un solo
    # panel, todos los módulos que cualquiera de sus roles habilita.
    Dado que un usuario tiene asignados los roles "medico" y "administrador"
    Cuando carga el panel principal
    Entonces el menú operativo muestra "Consultas"
    Y el dropdown "Administración" está visible y contiene "Usuarios",
      "Auditoría" y "Agenda y catálogo"
    Y no se le pide elegir entre un "modo médico" y un "modo administrador"
```

---

## 2. Criterios de aceptación medibles

Los RF originales describen el comportamiento pero no lo acotan con
números verificables. Se proponen valores concretos y parametrizables
(mismo patrón usado en RN-07, implementado como constante exportada en vez
de número mágico — ver `ANTELACION_MINIMA_CANCELACION_HORAS` en
`easyhealth-scheduling/src/scheduling/antelacion-cancelacion.ts`).

### RF-10 (refinado) — rellamado de turno

> Se rellama un turno hasta dos veces (tres llamados en total). Entre cada
> llamado deben transcurrir al menos 60 segundos antes de poder marcar el
> siguiente rellamado; si no transcurrieron, el intento se rechaza. Al
> tercer llamado sin respuesta, el turno pasa a "No asistió" de forma
> automática.

```gherkin
Característica: Rellamado de turno con criterio medible
  Escenario: Rellamado antes del tiempo mínimo
    Dado un turno en estado "llamado" cuyo último llamado fue hace 20 segundos
    Cuando el médico intenta rellamarlo
    Entonces el sistema rechaza la acción con un mensaje indicando cuántos
      segundos faltan para poder rellamar

  Escenario: Tercer llamado sin respuesta
    Dado un turno que ya fue llamado dos veces sin respuesta
    Y transcurrió el tiempo mínimo desde el último llamado
    Cuando el médico lo rellama por tercera vez
    Entonces el turno pasa a estado "No asistió" automáticamente
    Y la cita asociada cambia a estado "No asistió" (RF-10 + tabla de
      estados §9.1)
```

### RNF-08 (refinado) — tiempo de respuesta

> Las consultas de agenda y de historia clínica responden en menos de 2
> segundos en el percentil 95, con hasta 50 usuarios concurrentes activos
> (dimensionado para una institución de mediana complejidad, §2 del
> documento). Por encima de esa carga, el requisito no aplica y debe
> re-evaluarse capacidad de infraestructura, no código de aplicación.

```gherkin
Característica: Tiempo de respuesta bajo carga definida
  Escenario: Consulta de agenda con carga nominal
    Dado 50 usuarios concurrentes activos en el sistema
    Cuando un médico consulta la agenda del día
    Entonces el percentil 95 del tiempo de respuesta es menor a 2 segundos

  Escenario: Consulta de historia clínica con carga nominal
    Dado 50 usuarios concurrentes activos en el sistema
    Cuando un médico consulta el histórico de un paciente
    Entonces el percentil 95 del tiempo de respuesta es menor a 2 segundos
```

### RN-05 (aclarado) — caso borde de intercalado

> Si al momento de llamar el siguiente turno solo hay turnos prioritarios
> en espera (ningún estándar disponible para intercalar), la regla de "máximo
> dos prioritarios consecutivos" **no bloquea la fila**: se llama al
> prioritario igual. El límite de dos consecutivos solo aplica cuando
> existe al menos un turno estándar disponible para alternar.
>
> Ya implementado así en `easyhealth-checkin/src/checkin/turno-priority.ts`
> (`elegirSiguienteTurno`) — este escenario documenta y fija el
> comportamiento existente como contrato, para que no se rompa sin darse
> cuenta en un refactor futuro.

```gherkin
Característica: Intercalado de turnos prioritarios (RN-05)
  Escenario: Ya se llamaron dos prioritarios y hay un estándar en espera
    Dado que los últimos dos turnos llamados fueron prioritarios
    Y hay al menos un turno estándar en espera
    Cuando el médico llama el siguiente turno
    Entonces se llama a un turno estándar, no a otro prioritario

  Escenario: Ya se llamaron dos prioritarios pero no hay ningún estándar en espera
    Dado que los últimos dos turnos llamados fueron prioritarios
    Y todos los turnos en espera son prioritarios
    Cuando el médico llama el siguiente turno
    Entonces se llama a un turno prioritario igualmente
    Y el sistema no bloquea ni devuelve error
```

### RF-28 (nuevo, remanente de dispensación parcial)

> Cuando una fórmula queda con dispensación parcial por falta de stock, el
> remanente queda en estado "pendiente por faltante" indefinidamente — no
> expira por sí solo. Sigue siendo dispensable mientras la fórmula esté
> vigente (RN asociada §11: `fechaExpedicion + vigenciaDias`). Una vez
> vencida la vigencia, cualquier intento de dispensar el remanente debe
> rechazarse, y el remanente pendiente queda huérfano — el farmacéutico ya
> no puede completarlo aunque llegue stock nuevo.
>
> Ya implementado el rechazo por vencimiento en
> `easyhealth-pharmacy/src/pharmacy/pharmacy.service.ts:110`. **No
> implementado:** ninguna alerta ni reporte que liste fórmulas vencidas con
> remanente pendiente — hoy quedan invisibles salvo que alguien las busque
> una por una.

```gherkin
Característica: Remanente de dispensación parcial (RF-28)
  Escenario: Se completa el remanente dentro de la vigencia
    Dado una fórmula "pendiente por faltante" con 2 de 3 medicamentos
      dispensados, expedida hace 10 días con vigencia de 30 días
    Cuando llega stock nuevo y el farmacéutico dispensa el medicamento
      restante
    Entonces la fórmula pasa a estado "dispensada total"

  Escenario: La vigencia vence antes de completar el remanente
    Dado una fórmula "pendiente por faltante", expedida hace 31 días
      con vigencia de 30 días
    Cuando el farmacéutico intenta dispensar el medicamento restante
    Entonces el sistema rechaza la dispensación indicando que la fórmula
      ya no está vigente

  Escenario pendiente de implementar: Alertar remanentes vencidos
    Dado que existen fórmulas "pendiente por faltante" cuya vigencia venció
    Cuando el farmacéutico abre el listado de alertas de inventario
    Entonces ve una alerta "fórmulas vencidas con remanente sin dispensar"
    # Hoy no existe este listado — requiere un RF nuevo, no cubierto aún
```

---

## 3. Estados de UI ausentes en el documento original

El documento define estados de **datos** (cita, ticket) pero no estados de
**interfaz**. Estos son los tres que un QA encuentra primero al probar:

### RNF-13 (nuevo) — estados de carga, vacío y error

> Toda pantalla que consulte datos externos debe definir explícitamente
> qué se muestra en sus tres estados no felices: cargando, vacío (la
> consulta funcionó pero no hay datos) y error (la consulta falló). Un
> estado vacío nunca debe verse igual que un estado de error.

```gherkin
Característica: Estados de carga, vacío y error
  Escenario: Admisionista busca un documento sin cita programada
    Dado que un paciente con documento "123456" no tiene cita para hoy
    Cuando el admisionista busca ese documento
    Entonces el sistema muestra "Este paciente no tiene citas hoy"
    Y no muestra una tabla vacía sin explicación ni un mensaje de error

  Escenario: Paciente sin fórmulas activas
    Dado que un paciente no tiene ninguna fórmula vigente
    Cuando entra a "Mi fórmula"
    Entonces ve un mensaje "No tenés fórmulas activas en este momento"

  Escenario: El servicio de farmacia no responde
    Dado que el servicio "easyhealth-pharmacy" no responde
    Cuando el farmacéutico abre "Fórmulas pendientes"
    Entonces el sistema muestra un mensaje de error distinguible del
      estado vacío, con opción de reintentar
    Y no muestra una página en blanco ni un stack trace
```

### RN-08 (nuevo) — confirmación explícita en acciones irreversibles

> Toda acción que produzca un estado no reversible por el usuario (cerrar
> consulta — RN-03 la vuelve inmutable —, cancelar cita, desactivar
> usuario, cerrar ticket) exige un paso de confirmación explícito antes de
> ejecutarse. No es un supuesto de diseño: es un requisito verificable.
>
> **Hoy no implementado** en ninguno de los módulos construidos esta sesión
> (`easyhealth-identity-patient/src/app/[locale]/(auth)/dashboard/consultas/[id]/actions.ts`
> `cerrarConsultaAction`, y equivalentes de cancelar cita / desactivar
> usuario / cerrar ticket) — son un solo submit sin diálogo intermedio.

```gherkin
Característica: Confirmación antes de una acción irreversible
  Escenario: Cerrar una consulta médica
    Dado que un médico completó la nota de evolución de una consulta
    Cuando hace clic en "Cerrar consulta"
    Entonces el sistema le pide confirmar, advirtiendo que la consulta
      quedará inmutable (RN-03) y solo se podrán agregar notas aclaratorias
    Y la consulta solo se cierra si confirma explícitamente

  Escenario: Cancelar el cierre por error
    Dado que un médico hizo clic en "Cerrar consulta" por accidente
    Cuando el diálogo de confirmación aparece
    Y el médico elige "Cancelar"
    Entonces la consulta permanece abierta y editable
```

### RF-48 (nuevo) — reintento y registro de notificaciones fallidas

> RF-22 y RF-44 no especifican canal ni comportamiento ante fallo de envío.
> Se define: el canal primario es email (vía `easyhealth-notification`,
> Mailtrap en desarrollo). Si el envío falla, se registra el intento
> fallido (destinatario, plantilla, motivo del fallo, timestamp) y se
> reintenta hasta 3 veces con backoff exponencial; agotados los reintentos,
> el fallo queda visible para un administrador — no debe fallar en
> silencio.
>
> **Hoy no implementado.** El patrón actual en todo el sistema es
> "degradación con warning en log, sin bloquear la operación principal" —
> correcto para no tumbar el flujo clínico por un correo caído, pero el
> log no es un registro consultable por un humano no técnico, y no hay
> reintento.

```gherkin
Característica: Notificaciones con reintento y trazabilidad de fallos
  Escenario: Falla el envío de confirmación de cita
    Dado que se creó una cita nueva
    Y el servicio de correo no está disponible
    Cuando el sistema intenta enviar la confirmación
    Entonces el intento fallido queda registrado con destinatario,
      plantilla y motivo
    Y el sistema reintenta automáticamente hasta 3 veces

  Escenario: Se agotan los reintentos
    Dado que un envío de notificación falló 3 veces
    Cuando un administrador consulta el panel de notificaciones fallidas
    Entonces ve el registro con la opción de reenviar manualmente
```

---

## 4. Accesibilidad

RNF-05 (legibilidad a 5 metros de la pantalla pública) es hoy el único
requisito de accesibilidad del documento, y ya está resuelto — ver
`easyhealth-identity-patient/src/app/[locale]/pantalla-turnos/page.tsx`.
No alcanza para un sistema cuya población prioritaria (RF-07) incluye
adultos mayores y personas con discapacidad.

**RNF-14 (nuevo).** Contraste mínimo AA de WCAG 2.1 (4.5:1 texto normal,
3:1 texto grande) en toda la interfaz. **RNF-15 (nuevo).** Los formularios
críticos (agendamiento, admisión, registro de consulta) son operables
íntegramente con lector de pantalla y navegación por teclado. **RNF-06
(re-especificado).** "Responsivo" se acota a breakpoints concretos: móvil
(360–767px), tablet (768–1023px), escritorio (≥1024px); dispositivos
objetivo mínimos: un smartphone Android de gama media y un desktop 1366×768.

**Validación externa (skill `ui-ux-pro-max`, base de datos independiente de
84 estilos / 98 guías de UX).** Se corrió una búsqueda con el rubro
"healthcare" contra el stack real del proyecto (Next.js) — dos hallazgos
confirman, de forma independiente, lo ya reportado en esta adenda:

- *Form Labels* / *Input Labels* (severidad **Alta** en la base de datos):
  "Placeholder-only inputs" está explícitamente listado como anti-patrón
  — coincide exactamente con el hallazgo de esta sección sobre los seis
  módulos construidos esta sesión.
- *Submit Feedback* (severidad **Alta**): "No feedback after submit" es
  anti-patrón — coincide con el punto 8 de la revisión QA/UX previa (sin
  estado de carga visible en los submits).

El estilo recomendado para el rubro es **"Accessible & Ethical"** (target
WCAG AAA, no solo AA — más estricto que el RNF-14 propuesto arriba;
válido como aspiración, RNF-14 queda como el piso obligatorio). Paleta y
tipografía (azul clínico `#0284C7` + verde salud `#16A34A` + Figtree/Noto
Sans) quedaron persistidas en
`easyhealth-identity-patient/design-system/easyhealth/MASTER.md` como
referencia de implementación — no es un requisito nuevo, es la guía de
estilo que ayuda a cumplir RNF-14/15 de forma consistente en todo el
frontend en vez de decisión por decisión.

**Hallazgo de auditoría (no bloqueante, pero sistemático):** en los seis
módulos construidos esta sesión (Citas, Admisión, Consultas, Farmacia,
Agenda-admin, Soporte), casi todos los `<input>`/`<select>`/`<textarea>`
usan `placeholder` como única pista visual, sin `<label>` asociado — un
lector de pantalla no anuncia el propósito del campo una vez que tiene
texto escrito. Viola RNF-15 propuesto arriba.

```gherkin
Característica: Accesibilidad de formularios críticos
  Escenario: Contraste mínimo en botones de acción
    Dado cualquier botón de acción primaria en el sistema
    Cuando se mide el contraste entre texto y fondo
    Entonces el ratio es de al menos 4.5:1

  Escenario: Formulario de admisión operable con lector de pantalla
    Dado un admisionista usando un lector de pantalla
    Cuando navega el formulario "Buscar paciente"
    Entonces cada campo anuncia su propósito mediante un <label> asociado,
      no solo un placeholder
    Y el orden de tabulación sigue el orden visual del formulario

  Escenario: Layout responsivo en los tres breakpoints objetivo
    Dado el módulo de Citas
    Cuando se visualiza en 360px, 768px y 1366px de ancho
    Entonces ninguna tabla provoca scroll horizontal de toda la página
      (el scroll queda contenido dentro de la tabla)
    Y ningún botón de acción queda oculto o cortado
```

---

## 5. Concurrencia

El documento no contempla condiciones de carrera. La auditoría de código
encontró tres casos concretos, con estados de implementación distintos:

| Caso | RF | Estado real |
|---|---|---|
| Doble reserva de la misma franja horaria | RF-19 | **Resuelto.** `uniqueIndex('cita_profesional_franja_idx')` en `easyhealth-scheduling/src/db/schema.ts` — Postgres rechaza el segundo insert con conflicto 23505, capturado y devuelto como 409. |
| Doble dispensación del mismo lote de inventario | RF-28 | **No resuelto.** `dispensarLinea` en `easyhealth-pharmacy/src/pharmacy/pharmacy.service.ts:222` hace `SELECT saldo` y luego `UPDATE saldo = saldo - cantidad` en pasos separados, sin bloqueo. Dos dispensaciones concurrentes sobre el mismo lote pueden leer el mismo saldo y ambas descontarlo, dejando saldo negativo/incorrecto. |
| Dos agentes asignándose el mismo ticket | RF-42 | **No resuelto.** `asignar` en `easyhealth-helpdesk/src/helpdesk/helpdesk.service.ts` actualiza sin condición `WHERE estado = 'abierto'` — el segundo `UPDATE` gana en silencio, sin error, y ambos agentes creen haberlo tomado. |

**RN-09 (nuevo).** Toda operación que decremente un recurso compartido
(saldo de inventario, franja de agenda, asignación de ticket) debe usar
bloqueo optimista (columna de versión o condición `WHERE` sobre el estado
esperado, rechazando con 409 si cambió) o bloqueo pesimista (`SELECT ...
FOR UPDATE` dentro de una transacción). El patrón ya usado para citas
(unique index) es la referencia a replicar, no una excepción aislada.

```gherkin
Característica: Bloqueo optimista sobre recursos compartidos (RN-09)
  Escenario: Dos reservas simultáneas de la misma franja (ya resuelto)
    Dado que dos agendadores intentan reservar la franja de las 10:00
      con el mismo profesional, al mismo tiempo
    Cuando ambas solicitudes llegan casi simultáneamente
    Entonces solo una cita se crea exitosamente
    Y la segunda solicitud recibe un error 409 "franja ya ocupada"

  Escenario: Dos dispensaciones simultáneas del mismo lote (bug confirmado, sin corregir)
    Dado un lote con saldo de 5 unidades
    Y dos fórmulas distintas que requieren 5 unidades cada una del mismo lote
    Cuando ambas dispensaciones se procesan al mismo tiempo
    Entonces solo una debe tener éxito
    Y la segunda debe fallar con "stock insuficiente", no descontar
      saldo negativo
    # Estado actual: ambas tienen éxito y el saldo queda en -5. Requiere
    # fix: UPDATE ... WHERE saldo >= cantidad, verificando rowCount.

  Escenario: Dos agentes tomando el mismo ticket (bug confirmado, sin corregir)
    Dado un ticket en estado "abierto"
    Cuando dos agentes de soporte lo asignan a sí mismos casi
      simultáneamente
    Entonces solo el primero en llegar queda asignado
    Y el segundo recibe un error indicando que el ticket ya fue asignado
    # Estado actual: el segundo UPDATE sobrescribe sin error. Requiere
    # fix: UPDATE ... WHERE estado = 'abierto', verificando rowCount.
```

---

## 6. Metodología — fase de pruebas incompleta (§16)

La fase "9. Pruebas" del documento original solo contempla funcionales,
integración y control de acceso. Se agrega:

```gherkin
Característica: Fase de pruebas ampliada (§16, iteración 9)
  Escenario: Prueba de usabilidad con población prioritaria
    Dado un adulto mayor sin experiencia previa con sistemas web
    Cuando se le pide agendar una cita sin ayuda ni instrucciones previas
    Entonces completa el flujo en menos de 5 minutos
    Y no requiere más de una aclaración externa

  Escenario: Auditoría de accesibilidad automatizada
    Dado el conjunto de pantallas críticas (agendamiento, admisión,
      consulta, farmacia)
    Cuando se ejecuta un análisis automatizado tipo axe-core / Lighthouse
    Entonces no se reportan violaciones de nivel "crítico" o "serio"

  Escenario: UAT diferenciado por rol antes del cierre
    Dado que el sistema está en ambiente de staging
    Cuando cada rol (paciente, agendador, admisionista, médico,
      farmacéutico, agente de soporte, administrador) ejecuta su flujo
      principal de punta a punta
    Entonces cada representante de rol firma su aceptación por separado
    Y ninguna firma de aceptación puede darse por otro rol
```

---

## Resumen — nuevos identificadores introducidos por esta adenda

| ID | Tipo | Título |
|---|---|---|
| RNF-12 | No funcional | Navegación filtrada por rol |
| RNF-13 | No funcional | Estados de carga, vacío y error |
| RNF-14 | No funcional | Contraste mínimo WCAG AA |
| RNF-15 | No funcional | Formularios críticos operables con lector de pantalla |
| RNF-06 (re-especificado) | No funcional | Breakpoints y dispositivos objetivo concretos |
| RN-08 | Regla de negocio | Confirmación explícita en acciones irreversibles |
| RN-09 | Regla de negocio | Bloqueo optimista/pesimista sobre recursos compartidos |
| RF-48 | Funcional | Reintento y registro de notificaciones fallidas |
| RF-28 (ampliado) | Funcional | Manejo del remanente de dispensación parcial |
