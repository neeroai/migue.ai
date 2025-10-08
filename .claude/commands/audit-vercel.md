---
description: Audit code for Vercel deployment with Edge Functions & TypeScript experts
allowed-tools: Task
---

# Vercel Deployment Audit

Ejecuta auditoría estricta del código en preparación para despliegue a Vercel.

## Agents to Execute (in parallel)

### 1. @edge-functions-expert
Audita **Edge Runtime compliance** en:
- `app/api/` - Todas las rutas Edge Functions
- `lib/` - Compatibilidad con Edge Runtime

**Criterios:**
- ✅ Todas las rutas exportan `export const runtime = 'edge'`
- ✅ NO usan Node.js APIs (**fs**, **child_process**, etc.)
- ✅ Solo imports estáticos (NO dynamic **await import()**)
- ✅ Bundle size optimizado (<1MB por función)
- ✅ Cold start <100ms
- ✅ WhatsApp webhook <5s timeout compliance

### 2. @typescript-pro
Audita **type safety & production readiness** en:
- `app/` - Rutas y handlers
- `lib/` - Utilidades y clientes

**Criterios:**
- ✅ TypeScript strict mode compliant
- ✅ NO **any** types (usar **unknown**)
- ✅ Array access seguro (**array[i]!** cuando certero)
- ✅ Nullable handling (**exactOptionalPropertyTypes: true**)
- ✅ Proper error handling (no uncaught promises)
- ✅ Zod schema validation en APIs

## Files Críticos

**Current git status:**
`git status --short`

**Archivos a revisar:**
- `app/api/whatsapp/webhook/route.ts` - Webhook principal
- `app/api/cron/maintain-windows/route.ts` - Mantenimiento ventanas
- `lib/whatsapp.ts` - Cliente WhatsApp API
- `lib/messaging-windows.ts` - Gestión ventanas 24h
- `lib/ai-processing-v2.ts` - Multi-provider AI
- `lib/persist.ts` - Persistencia mensajes
- `lib/message-normalization.ts` - Normalización v23.0

## Success Criteria

**0 errores críticos** en:
- Edge Runtime compatibility
- TypeScript type safety
- Production readiness
- WhatsApp API v23.0 compliance
- Security vulnerabilities

## Output Format

Cada agente debe reportar:
1. ✅ **Passed checks** (lista)
2. ⚠️ **Warnings** (no bloqueantes, mejoras recomendadas)
3. ❌ **Critical errors** (bloqueantes para deploy)
4. 📋 **Action items** (si hay errores)
