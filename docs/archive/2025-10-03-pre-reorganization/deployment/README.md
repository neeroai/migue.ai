# 📚 Vercel Deployment Documentation - Index

Documentación completa sobre despliegue en Vercel Edge Functions, optimizada para WhatsApp bots con GPT-4o y Supabase.

---

## 🎯 Quick Start

### Para Nuevos Desarrolladores
1. **[Edge Functions Guide](../VERCEL-EDGE-FUNCTIONS-GUIDE.md)** - Empezar aquí
2. **[Best Practices 2025](../VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md)** - Configuración esencial
3. **[WhatsApp Architecture](../VERCEL-WHATSAPP-BOT-ARCHITECTURE.md)** - Arquitectura del proyecto

### Para Troubleshooting
1. **[Troubleshooting Guide](../VERCEL-DEPLOYMENT-FIX.md)** - Problemas comunes
2. **[Vercel Troubleshooting](../VERCEL_TROUBLESHOOTING.md)** - Guía de resolución de problemas

---

## 📖 Documentation Index

### 1. 🚀 [Edge Functions Guide](../VERCEL-EDGE-FUNCTIONS-GUIDE.md)
**Guía completa de Vercel Edge Functions**

- Diferencias Edge Runtime vs Node.js
- Configuración con `export const config = { runtime: 'edge' }`
- APIs compatibles y limitaciones
- Streaming responses
- Performance optimization (40% más rápido, 15x menos costo)
- Ejemplo completo de WhatsApp AI bot

**Cuándo leer:** Antes de crear cualquier Edge Function

---

### 2. ⚙️ [Deployment Best Practices 2025](../VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md)
**Mejores prácticas actualizadas para deployments en Vercel**

- Configuración de `vercel.json` (framework detection automática)
- Environment variables management
- `.vercelignore` optimization
- Git workflow y commit conventions
- Caching strategies (s-maxage, stale-while-revalidate)
- Security headers y rate limiting
- Testing antes de deploy

**Cuándo leer:** Al configurar proyecto nuevo o antes de deploy a producción

---

### 3. ⚡ [Streaming AI Responses](../VERCEL-STREAMING-AI-RESPONSES.md)
**Implementación de streaming para respuestas de IA**

- ReadableStream API (Web Standard)
- Server-Sent Events (SSE) pattern
- GPT-4o streaming client edge-compatible
- WhatsApp chunked responses
- Client-side consumption (React hooks)
- Backpressure handling y error recovery
- Performance benchmarks (10x mejora percibida)

**Cuándo leer:** Al implementar respuestas de IA o mejorar UX

---

### 4. 📊 [Monitoring & Analytics](../VERCEL-MONITORING-ANALYTICS.md)
**Observabilidad completa para chatbots**

- KPIs clave (response time, intent accuracy, CSAT)
- Structured logging con tipos TypeScript
- Vercel Analytics integration
- Error tracking con Sentry
- Custom metrics dashboard en Supabase
- Slack alerting y health checks
- Real-time monitoring con logs

**Cuándo leer:** Al preparar producción o debuggear issues

---

### 5. 🏗️ [WhatsApp Bot Architecture](../VERCEL-WHATSAPP-BOT-ARCHITECTURE.md)
**Arquitectura completa de chatbot WhatsApp**

- Diagram de arquitectura completo
- Webhook verification y signature validation
- Message flow (GET verification, POST messages)
- AI processing pipeline (intent → response → send)
- Rate limiting por usuario
- Database schema optimizations
- Retry logic y graceful degradation
- Performance targets (< 2s response time)

**Cuándo leer:** Al entender o modificar la arquitectura del bot

---

### 6. 🗄️ [Supabase Integration](../VERCEL-SUPABASE-INTEGRATION.md)
**Integración optimizada con Supabase**

- Edge-compatible client setup
- RLS performance optimization (100x mejora)
- B-tree indexes y function wrapping technique
- Row Level Security policies
- Realtime subscriptions en Edge Functions
- Full-text search en español
- Connection pooling strategies
- Error handling y retry logic

**Cuándo leer:** Al trabajar con base de datos o optimizar queries

---

## 🔥 Quick Reference

### Comandos Esenciales

```bash
# Local development
vercel dev

# Build local
vercel build
npm run typecheck

# Deploy preview
vercel

# Deploy production
vercel --prod
git push origin main  # Auto-deploy en Vercel

# Logs en tiempo real
vercel logs --follow

# Ver errores
vercel logs --level error

# Environment variables
vercel env ls
vercel env add OPENAI_API_KEY production
```

### Configuración Crítica

```typescript
// Edge Function básica
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
```

```json
// vercel.json mínimo (NO especificar runtime)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [...],
  "headers": [...]
}
```

### Troubleshooting Rápido

| Error | Causa | Solución |
|-------|-------|----------|
| "Unsupported modules" | Dynamic imports en Edge | Usar static imports |
| "Cannot find module" | Paths incorrectos | Verificar imports, usar static |
| "Timeout exceeded" | Función > 25s | Optimizar queries, usar streaming |
| "Invalid signature" | HMAC validation falla | Verificar WHATSAPP_APP_SECRET |
| RLS queries lentos | Sin índices optimizados | Crear B-tree indexes, function wrapping |

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Tests pasan: `npm test`
- [ ] TypeScript sin errores: `npm run typecheck`
- [ ] Build exitoso: `npm run build`
- [ ] Todas las Edge Functions tienen `export const config = { runtime: 'edge' }`
- [ ] Solo static imports (NO dynamic imports)
- [ ] Environment variables configuradas en Vercel
- [ ] `.vercelignore` actualizado
- [ ] Security headers configurados

### Post-Deployment
- [ ] Verificar logs en Vercel Dashboard
- [ ] Test webhook con Postman/curl
- [ ] Verificar métricas en Vercel Analytics
- [ ] Health check passing
- [ ] Alertas configuradas (Slack/email)
- [ ] Monitoring dashboard activo

---

## 🎯 Performance Targets

| Métrica | Target | Herramienta |
|---------|--------|-------------|
| Edge Function Response | < 100ms | Vercel Analytics |
| WhatsApp Webhook | < 5s | Vercel Logs |
| Intent Classification | < 500ms | Custom Metrics |
| GPT-4o Response | < 2s | OpenAI Logs |
| Database Query | < 50ms | Supabase Dashboard |
| Total User Wait | < 3s | End-to-end testing |

---

## 📚 External Resources

### Vercel
- [Vercel Docs](https://vercel.com/docs)
- [Edge Functions](https://vercel.com/docs/functions/runtimes/edge)
- [Streaming](https://vercel.com/docs/functions/edge-functions/streaming)
- [Next.js 15](https://nextjs.org/docs)

### WhatsApp
- [Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Webhook Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)

### Supabase
- [Supabase Docs](https://supabase.com/docs)
- [RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices)
- [Realtime](https://supabase.com/docs/guides/realtime)

### OpenAI
- [OpenAI API Docs](https://platform.openai.com/docs)
- [GPT-4o Guide](https://platform.openai.com/docs/models/gpt-4o)
- [Streaming](https://platform.openai.com/docs/api-reference/streaming)

---

## 🆘 Getting Help

### Problemas Comunes
1. **Build falla con "unsupported modules"**
   - Leer: [Edge Functions Guide](../VERCEL-EDGE-FUNCTIONS-GUIDE.md#importaciones-y-dependencias)
   - Solución: Convertir a static imports

2. **Deployment exitoso pero errores en runtime**
   - Leer: [Troubleshooting Guide](../VERCEL-DEPLOYMENT-FIX.md)
   - Verificar logs: `vercel logs --follow`

3. **Queries lentos en Supabase**
   - Leer: [Supabase Integration](../VERCEL-SUPABASE-INTEGRATION.md#rls-performance-optimization)
   - Crear índices B-tree y optimizar RLS

4. **WhatsApp webhook no recibe mensajes**
   - Leer: [WhatsApp Architecture](../VERCEL-WHATSAPP-BOT-ARCHITECTURE.md#message-flow)
   - Verificar signature validation y environment variables

### Contacto
- Issues: [GitHub Issues](https://github.com/your-org/migue.ai/issues)
- Slack: #migue-ai-dev
- Email: dev@migue.ai

---

## 🔄 Updates

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2025-10-03 | Documentación inicial completa | Claude + Team |
| 2025-10-03 | Agregado RLS optimization guide | Claude |
| 2025-10-03 | Agregado streaming implementation | Claude |

---

## ✅ Contribution Guidelines

Para agregar o actualizar documentación:

1. Seguir estructura existente (Overview, Code Examples, Best Practices)
2. Incluir ejemplos de código TypeScript
3. Agregar referencias a docs oficiales
4. Actualizar este índice con nuevos docs
5. Commit con mensaje: `docs(vercel): add [topic] guide`

---

**Última actualización**: 2025-10-03
**Mantenido por**: Equipo migue.ai
**Versión**: 1.0.0

---

**¿Nuevo en el proyecto?** Empieza por [Edge Functions Guide](../VERCEL-EDGE-FUNCTIONS-GUIDE.md) → [Best Practices](../VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md) → [WhatsApp Architecture](../VERCEL-WHATSAPP-BOT-ARCHITECTURE.md)

**¿Problemas con deployment?** Lee [Troubleshooting Guide](../VERCEL-DEPLOYMENT-FIX.md) primero
