# Observability + E2E Runbook (Spec 23)

## Objetivo
Tener evidencia operativa para liberar cambios del core agéntico sin regresiones silenciosas.

## 1) Señales mínimas en logs
Buscar en Vercel Logs por `metric_name`:

- `sla.route_decision_ms`
- `sla.typing_start_ms`
- `sla.end_to_end_ms`
- `sla.slo_violation_count`
- `memory.read_ms`
- `memory.write_count`
- `memory.hit_ratio`
- `memory.profile_hit_ratio`

Campos obligatorios por evento:

- `requestId`
- `userId`
- `conversationId`
- `metadata.pathway`
- `metadata.metric_value`

## 2) SLO de release
- `TEXT_SIMPLE p95 end_to_end_ms < 2000`
- `error e2e < 1.5%`
- `duplicados de side effects = 0`

## 3) Queries operativas en Supabase

### Duplicados por `wa_message_id`
```sql
select wa_message_id, count(*)
from messages_v2
where wa_message_id is not null
group by wa_message_id
having count(*) > 1
order by count(*) desc;
```

### Ratio de error tool policy (por logs no estructurados en DB)
Mientras no se persista `agent_tool_calls` completo en runtime, revisar logs por:
- `[ToolPolicy] Tool execution failed`
- `[ToolPolicy] Tool denied`
- `[ToolPolicy] Tool requires confirmation`

### Backlog de eventos agénticos
```sql
select status, count(*)
from agent_events
group by status
order by status;
```

### Últimos runs fallidos
```sql
select id, event_id, input_class, failure_reason, created_at
from agent_runs
where status in ('failed', 'dead_letter')
order by created_at desc
limit 50;
```

## 4) Suite E2E mínima (CI/manual)
Ejecutar:
```bash
TEST_TYPE=integration npm run test:e2e
```

Cobertura mínima actual:
- texto con tool intent (recordatorio)
- texto simple sin side effect
- deduplicación por `wa_message_id`

## 5) Criterio operativo para promover deploy
1. `test:unit` y `test:e2e` en verde.
2. 3 corridas consecutivas sin flakes en integración.
3. Logs en producción con métricas `sla.*` y `memory.*`.
4. Sin duplicados en query de `messages_v2`.

## 6) Rollback rápido
1. Desactivar feature flag agéntica si aplica (`AGENT_EVENT_LEDGER_ENABLED=false`).
2. Confirmar que `input-orchestrator` siga resolviendo flujo clásico.
3. Reprocesar pendientes desde `agent_events` cuando se estabilice la causa raíz.
