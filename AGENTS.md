# AGENTS.md

Guia operativa para agentes de codigo en `migue.ai`.
Este archivo complementa `README.md` (humanos) con instrucciones accionables para trabajo autonomo en el repo.

## 1) Objetivo y alcance

- Proyecto: asistente IA por WhatsApp con backend en `Next.js` (App Router), runtime Edge, Supabase y OpenAI.
- Prioridad: cambios pequenos, seguros y verificables; evitar regresiones en webhook, cron y persistencia.
- Regla general: mantener consistencia con la arquitectura actual antes de introducir patrones nuevos.

## 2) Stack real del repositorio

- `next@16`, `react@19`, `typescript@5`
- Runtime principal: rutas en `app/api/**` con restricciones de Edge.
- Datos: Supabase (`supabase/schema.sql`, `supabase/migrations/`).
- Validacion: `zod` en `types/schemas.ts` y modulos relacionados.
- Testing: `jest` (unit/integration) y `playwright` (configurado).

## 3) Estructura relevante

- `app/api/whatsapp/webhook/route.ts`: ingreso principal de eventos WhatsApp.
- `app/api/cron/**`: jobs programados (recordatorios, salud, ventanas).
- `src/modules/**`: logica de dominio/aplicacion por feature.
- `src/shared/**`: infraestructura compartida (db, whatsapp, openai, observabilidad).
- `supabase/migrations/**`: cambios incrementales de BD.
- `tests/unit/**`: pruebas unitarias por feature.
- `specs/**`: decisiones y comportamiento esperado por modulo.

## 4) Flujo de trabajo recomendado para agentes

1. Leer primero archivos afectados + `specs/` del feature.
2. Hacer cambios minimos y localizados; no refactorizar fuera del alcance.
3. Reusar servicios/utilidades existentes en `src/modules` y `src/shared`.
4. Validar con pruebas targeteadas antes de proponer cambios amplios.
5. Actualizar documentacion y tracking cuando cambie comportamiento.

## 5) Comandos de desarrollo y validacion

- Instalar: `npm install`
- Desarrollo: `npm run dev`
- Typecheck: `npm run typecheck`
- Compactar tracking: `npm run tracking:compact`
- Unit tests: `npm run test:unit`
- Test unico: `npx jest tests/unit/<archivo>.test.ts`
- Cobertura: `npm run test:coverage`
- Verificacion pre deploy: `npm run pre-deploy`
- Verificacion DB: `npm run db:verify`
- Guardrail de imports legacy: `npm run check:no-lib-imports`

## 6) Reglas de implementacion

- Mantener compatibilidad con Edge Runtime:
  - Evitar APIs Node no soportadas en rutas Edge.
  - Favorecer `fetch`, Web Crypto y utilidades ya usadas en el repo.
- No introducir imports a `lib/**` legacy si existe equivalente en `src/**`.
- Preservar validaciones de entrada/salida con `zod` donde aplique.
- En integraciones externas (WhatsApp/OpenAI/Supabase), manejar errores con mensajes accionables y logging estructurado.
- No hardcodear secretos, IDs sensibles ni tokens en codigo o tests.

## 7) Base de datos (Supabase/Postgres)

- Todo cambio de esquema va en nueva migracion dentro de `supabase/migrations/`.
- No editar migraciones historicas ya aplicadas en entornos compartidos.
- Considerar indices y politicas RLS al agregar tablas/consultas sensibles.
- Si cambia contrato de datos, actualizar tipos y pruebas relacionadas.

## 8) Testing policy (Definition of Done minima)

Para cerrar una tarea de codigo:

- Ejecutar `npm run typecheck`.
- Ejecutar pruebas unitarias del area modificada.
- Si se toca flujo critico (`webhook`, `cron`, persistencia), correr `npm run test:unit`.
- Agregar/ajustar tests cuando cambia comportamiento observable.

## 9) Seguridad y operacion

- Nunca commitear secretos (`.env.local`, tokens, keys).
- Mantener redaccion segura en logs (sin exponer PII completa).
- Respetar limites y ventanas de WhatsApp (24h/template y rate limits).
- Para cambios con impacto operativo, incluir nota de rollback simple.

## 10) Documentacion y tracking obligatorio

Cuando haya cambios de codigo, mantener actualizados:

- `.claude/session.md`
- `CHANGELOG.md`
- `.claude/status.md`
- `.claude/decisions.md`
- `.claude/todo.md`

Si aplica, actualizar tambien `specs/*.md` del feature afectado.

Referencia base de proceso:

- `docs/tracking-best-practices.md`
- `docs/session-continuity-runbook.md`

### Fuente unica de verdad por archivo (obligatoria)

- `.claude/session.md`: handoff entre sesiones; no duplicar estado global.
- `.claude/status.md`: solo estado actual, foco y riesgos.
- `.claude/todo.md`: solo backlog operativo (pending/in_progress/completed).
- `.claude/decisions.md`: solo decisiones y tradeoffs (ADR).
- `.claude/CHANGELOG.md`: historial tecnico interno de cambios.
- `CHANGELOG.md`: cambios relevantes del proyecto para consumidores humanos.
- `.claude/handoff.md`: estado operativo corto para reanudar la siguiente sesion.
- `docs/master-tracker.md`: tablero maestro autogenerado desde `specs/*.md`.

No copiar la misma narrativa completa en multiples archivos.

### Minimo de evidencia por entrada

Cada entrada de tracking debe incluir, cuando aplique:

- fecha/hora
- accion (Implement/Validate/Decide/Fix/Document)
- alcance (feature/modulo)
- evidencia (ruta de archivo y/o comando/test)
- resultado (`Complete`, `Partial`, `Blocked`)

Evitar entradas vagas sin evidencia verificable.

### Politica de tamano (estricta)

Los tracking files deben permanecer pequenos y legibles. Validar con:

- `just check-tracking`

Limites actuales (lineas/bytes):

- `.claude/session.md`: 180 / 24000
- `.claude/status.md`: 120 / 16000
- `.claude/decisions.md`: 420 / 64000
- `.claude/todo.md`: 100 / 10000
- `.claude/CHANGELOG.md`: 320 / 52000
- `CHANGELOG.md`: 240 / 40000

Si un archivo supera limite: resumir entradas antiguas y conservar detalle reciente.

### Politica de compactacion (obligatoria)

- Objetivo: tracking para retomar contexto rapido, no para historial exhaustivo.
- Mantener detalle solo de actividad reciente:
  - `session.md`: maximo 4 sesiones detalladas.
  - `todo.md`: maximo 20 tareas completadas (dejar solo recientes).
  - `decisions.md`: maximo 10 ADRs completos; resumir ADRs antiguos.
  - `.claude/CHANGELOG.md`: conservar cambios recientes y resumir periodos anteriores.
- Cuando haya crecimiento acumulativo, consolidar en secciones de "Historical Summary" (5-10 bullets).
- Si se necesita detalle historico largo, moverlo fuera de tracking files (por ejemplo `docs/`).

### Cadencia operativa recomendada

- Inicio de sesion: correr `just resume`.
- Durante la sesion: registrar hitos reales (decision, implementacion, validacion, bloqueo).
- Cierre de sesion: ejecutar `just close-session "..." "..." "step1|step2" "[blockers]" "[files]" "[commands]"`.
- Semanal o tras sesiones intensas: correr `npm run tracking:compact` (compatibilidad legacy).

### Checklist de cierre de sesion (obligatorio)

- [ ] `session.md` actualizado con operaciones y notas de reanudacion.
- [ ] `todo.md` sincronizado con estado real de tareas.
- [ ] `status.md` actualizado si cambio el estado del proyecto.
- [ ] `decisions.md` actualizado si hubo decisiones relevantes.
- [ ] changelog(s) actualizados si hubo cambios observables.
- [ ] `just sync-master` ejecutado.
- [ ] `just check-tracking` ejecutado.

## 11) Convenciones de entrega para agentes

- Explicar que se cambio, por que y como se valido.
- Incluir rutas de archivo exactas modificadas.
- Declarar explicitamente cualquier parte no validada o pendiente.
- Proponer siguientes pasos solo cuando agreguen valor inmediato.

## 12) Regla SDD para nuevas features (obligatoria)

- Si el usuario pide cambios y el alcance clasifica como **nueva feature** o cambio de comportamiento relevante, el agente debe aplicar metodologia SDD.
- En esos casos, antes o junto con la implementacion se debe crear/actualizar una spec en `specs/` con:
  - objetivo y alcance
  - estado (`planned`, `in_progress`, `done`)
  - arquitectura/flujo
  - decisiones clave y tradeoffs
  - criterios de validacion
- Si el usuario omite pedir la spec, el agente debe recordarlo explicitamente y proponer crearla.
- Esta regla aplica siempre para mantener trazabilidad de producto y arquitectura durante la migracion modular.
