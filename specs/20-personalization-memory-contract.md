# 20 - Personalization And Memory Contract

## Estado
- Semaforo: `RED`
- Fecha: `2026-02-08`
- Owner tecnico: `src/modules/ai/domain/memory.ts`

## Objetivo funcional
Garantizar personalizacion consistente y memoria util para que el asistente responda como continuidad real de conversacion por WhatsApp.

## Principio
No depender de "recuerdo perfecto". Usar contrato de memoria en capas:
1. historial reciente (conversacion activa)
2. memoria semantica (facts relevantes)
3. perfil persistente (preferencias estables)

## Capas de memoria
### 1) Conversational window
- Fuente: `messages_v2`.
- Uso: ultimos N turnos para continuidad inmediata.
- Politica default: `N=12` mensajes utiles.

### 2) Semantic memory
- Fuente: `user_memory` + RPC `search_user_memory`.
- Uso: hechos recuperables por similitud semantica.
- Politica default: `top_k=5`, score minimo configurable.

### 3) Memory profile
Tabla nueva `memory_profile`:
- `user_id uuid pk`
- `display_name text`
- `tone_preference text`
- `language_preference text`
- `timezone text`
- `goals jsonb`
- `constraints jsonb`
- `updated_at timestamptz`

## Read policy por input class
- `TEXT_SIMPLE`: window corta + profile minimo (sin retrieval pesado).
- `TEXT_TOOL_INTENT`: window + facts relevantes + profile.
- `RICH_INPUT`: window reducida + profile, retrieval opcional segun costo.

## Write policy
Se escribe memoria cuando:
- el mensaje contiene dato personal estable.
- hay preferencia explicita del usuario.
- se cierra una accion relevante (recordatorio, gasto, cita).

No se escribe memoria cuando:
- datos efimeros sin utilidad futura.
- contenido sensible sin consentimiento/politica.

## Contrato de respuesta de memoria
Ante preguntas tipo "que sabes de mi":
- nunca responder "no tengo historial" si hay datos en window/profile.
- responder con nivel de confianza y limites.
- evitar inventar facts no persistidos.

## Observabilidad minima
- `memory_read_ms`
- `memory_write_count`
- `memory_hit_ratio`
- `profile_hit_ratio`

## Pruebas clave
1. Historial disponible -> respuesta usa contexto real.
2. Perfil actualizado -> cambia tono/idioma en siguientes respuestas.
3. Sin memoria relevante -> respuesta honesta, no alucinada.

## Criterio de salida a YELLOW
1. `memory_profile` operativa.
2. Read/write policy aplicada por input class.
3. Tests de regression para prompts de historial/personalizacion.
