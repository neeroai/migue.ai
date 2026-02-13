# 26 - soul-personalization-humanization

## Estado
- Semáforo: `YELLOW`
- Fase: `in_progress`
- Next Step: Ejecutar validación e2e conversacional en producción y ajustar umbrales de estilo local por ciudad.
- Updated: 2026-02-13 00:00
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/ai/application/soul-composer.ts`

## Objetivo funcional
Humanizar migue.ai con una capa SOUL que personalice tono y estilo por usuario, incluyendo adaptación local (Barranquilla, Bogotá, Medellín) con emojis naturales.

## Alcance
- Introducir `SOUL.md` como manifiesto de identidad.
- Componer prompt dinámico con memoria, perfil y estilo local.
- Aprender señales de personalización y persistirlas en `memory_profile`.
- Aplicar guardrails anti-robot y límite de emojis.

## Contratos clave
- Entrada normalizada.
- Contexto de agente (historial + memoria + perfil + señales SOUL).
- Respuesta final al usuario (humana, útil, personalizada, sin caricatura).

## Evidencia mínima
- Typecheck en verde.
- Tests unitarios de `soul-composer`, `locale-style-resolver`, `soul-policy`.
- Logs y métricas `soul.*` emitidas por turno.

## Riesgos y gaps
- Sobreajuste de estilo regional por inferencia ambigua.
- Riesgo de sonar “actuado” si el regionalismo no se regula por confianza.
- Requiere observación de métricas en producción para calibración.

## Siguiente incremento
Cerrar validación e2e con muestras reales por ciudad y mover `YELLOW -> GREEN`.
