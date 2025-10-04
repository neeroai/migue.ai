# PO Master Checklist – Coherencia PRD vs Arquitectura

Fecha: 2025-09-29
Revisor: PO
Documentos: `docs/prd.md`, `docs/architecture.md`, `docs/IMPLEMENTATION-PLAN-BMAD.md`

## Resumen Ejecutivo
- Estado general: READY (alto nivel coherente)
- Fortalezas: Arquitectura y PRD alinean endpoints, epics, NFRs y costos.
- Observaciones: Añadir detalles de límites (tamaño audio, cuotas documentos) y OpenAPI.

## Resultados por Categoría
| Categoría                                | Status   | Notas |
| ---------------------------------------- | -------- | ----- |
| 1. Project Setup & Initialization        | PASS     | Entornos definidos (Vercel/Supabase/OpenAI). |
| 2. Infrastructure & Deployment           | PASS     | Edge + Cron + RLS descritos. |
| 3. External Dependencies & Integrations  | PASS     | Meta WhatsApp, OpenAI, Supabase referenciados. |
| 4. UI/UX Considerations                  | N/A      | Sin UI en MVP. |
| 5. User/Agent Responsibility             | PASS     | Roles BMAD/agents definidos en plan. |
| 6. Feature Sequencing & Dependencies     | PASS     | Fases 1→4 con epics/historias. |
| 7. Risk Management (Brownfield)          | N/A      | Greenfield. |
| 8. MVP Scope Alignment                   | PASS     | MVP claro; no-objetivos listados. |
| 9. Documentation & Handoff              | PARTIAL  | Falta OpenAPI inicial y ejemplos curl. |
| 10. Post-MVP Considerations              | PARTIAL  | Se menciona multi-tenant; definir criterios de activación. |

## Coherencia PRD ↔ Arquitectura
- Endpoints: Coinciden (`webhook`, `send`, `ai/*`, `documents/*`, `reminders/*`). PASS
- Datos: Tablas en PRD y arquitectura equivalentes. PASS
- NFRs: Latencia, disponibilidad, costo por usuario, observabilidad. PASS
- Seguridad: RLS, HMAC, no secretos en código. PASS

## Gaps / Acciones
1) OpenAPI 3.1 inicial de endpoints (contract-first) con ejemplos curl. Acción: `api-documenter`.
2) Límites explícitos:
   - Tamaño máximo de audio (MB) y duración (min). Acción: `ai-engineer` + `backend-developer`.
   - Políticas de retención de `messages`/media (días) y cuotas de documentos. Acción: `data-engineer`.
3) Definir respuesta de error estándar (códigos, body) e idempotencia en `send`. Acción: `api-designer`.
4) Métricas mínimas por endpoint (latencia, errores) y alertas. Acción: `code-reviewer`/`backend-developer`.

## Criterios de Aceptación MVP (verificados)
- Texto E2E < 2s p95. PASS
- Recordatorios ±1 min. PASS
- Audio ≤ 2 min transcribe + resumen. PARTIAL (definir límite exacto)
- RAG con 1–2 citas y topK≤5. PASS

## Decisión Final
- READY con acciones menores (contract docs y límites operativos).
