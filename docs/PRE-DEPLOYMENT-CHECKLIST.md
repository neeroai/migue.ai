# Pre-Deployment Checklist - migue.ai

Checklist completo antes de deployment a Vercel producción.

---

## ✅ Fase 1: Code Quality

### TypeScript & Tests
- [x] **npm test** → 71/71 tests passing
- [ ] **npm run typecheck** → ⚠️ Errores conocidos en archivos legacy (no bloqueantes)
- [x] **Refactoring completado** → webhook.ts: 459 → 177 LOC
- [x] **Nuevos módulos creados** → 6 archivos (validation, normalization, ai-processing, env, logger)

### Code Standards
- [x] Todos los archivos ≤300 LOC
- [x] TypeScript strict mode compliant (nuevos archivos)
- [x] Edge Runtime export en todos los endpoints
- [x] ESM imports (no require)
- [x] Structured logging implementado

---

## ✅ Fase 2: Configuration

### Environment Variables
**Local (.env.local):**
- [x] WHATSAPP_TOKEN
- [x] WHATSAPP_PHONE_ID
- [x] WHATSAPP_VERIFY_TOKEN
- [x] WHATSAPP_APP_SECRET
- [x] SUPABASE_URL
- [x] SUPABASE_KEY
- [x] OPENAI_API_KEY
- [ ] CRON_SECRET (opcional, configurar para producción)

**Vercel Dashboard:**
- [ ] Verificar todas las variables en Settings → Environment Variables
- [ ] Separar por ambiente (Production/Preview/Development)
- [ ] CRON_SECRET configurado para producción

### Vercel Configuration
- [x] `vercel.json` configurado correctamente
- [x] 2 cron jobs configurados:
  - [x] `/api/cron/check-reminders` (9 AM UTC diario)
  - [x] `/api/cron/follow-ups` (cada 6 horas)
- [x] Headers configurados (Cache-Control)
- [x] Framework: nextjs
- [x] NO runtime especificado en functions (auto-detect ✓)

---

## ✅ Fase 3: Security

### Authentication & Validation
- [x] HMAC signature validation (webhook.ts:validateSignature)
- [x] Constant-time comparison (timing attack prevention)
- [x] Zod schema validation (13 message types)
- [x] Cron authentication implementado (Bearer token)
- [x] Environment validation with Zod
- [ ] RLS policies en Supabase (⚠️ actualmente permissive - OK para desarrollo)

### Secrets Management
- [x] No secrets en código
- [x] No secrets en logs
- [x] .env* en .gitignore
- [x] Variables sensibles en Vercel env (not in repo)

---

## ✅ Fase 4: API Endpoints

### Functional Tests
**WhatsApp Webhook:**
- [x] GET verification endpoint
- [x] POST message reception
- [x] Signature validation
- [x] Message normalization (13 types)
- [x] AI processing pipeline
- [x] Structured logging

**Cron Jobs:**
- [x] Check reminders endpoint
- [x] Follow-ups endpoint
- [x] Authentication with CRON_SECRET
- [x] Error handling

### Test Files Created
```
tests/manual/
├── webhook-payload.json          ✅
├── webhook-audio.json            ✅
├── webhook-interactive.json      ✅
├── test-webhook-signature.sh     ✅
├── test-all-endpoints.sh         ✅
├── README.md                     ✅
└── QUICKSTART.md                 ✅
```

---

## 🧪 Fase 5: Local Testing

### Before Production Deploy

**1. Iniciar servidor local:**
```bash
npm run dev:vercel
# Esperar: "Ready! Available at http://localhost:3000"
```

**2. Ejecutar test suite:**
```bash
cd tests/manual
./test-all-endpoints.sh
```

**3. Verificar resultados:**
- [ ] Webhook verification: ✅ PASS
- [ ] Text message: ✅ PASS
- [ ] Audio message: ✅ PASS
- [ ] Interactive button: ✅ PASS
- [ ] Invalid payload: ✅ 400 error
- [ ] Cron reminders: ✅ PASS
- [ ] Cron follow-ups: ✅ PASS

**4. Verificar logs:**
- [ ] Logs estructurados en JSON
- [ ] RequestId presente
- [ ] Duration tracked
- [ ] No errors en processing

### Manual Tests (Opcionales)
```bash
# Webhook verify
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TEST&hub.challenge=abc"

# Text message
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-payload.json

# Cron
curl http://localhost:3000/api/cron/check-reminders
```

---

## 🚀 Fase 6: Deployment

### Pre-Deploy Validation
- [ ] `npm test` → 71/71 passing
- [ ] Local tests pasan (test-all-endpoints.sh)
- [ ] No errores críticos en `vercel dev`
- [ ] Variables configuradas en Vercel Dashboard
- [ ] Git committed & pushed

### Deployment Commands

**Preview (staging):**
```bash
vercel
# URL: https://migue-ai-xxxxx.vercel.app
```

**Production:**
```bash
vercel --prod
# URL: https://migue.app
```

### Post-Deploy Verification
- [ ] Webhook verification funciona: `GET /api/whatsapp/webhook?hub.mode=...`
- [ ] Configurar webhook URL en Meta Developer Console
- [ ] Test mensaje real desde WhatsApp
- [ ] Verificar cron jobs en Vercel Dashboard → Cron
- [ ] Monitorear logs: `vercel logs --follow`
- [ ] Verificar métricas en Vercel Analytics

---

## 📊 Status Actual

### Completado ✅
- [x] Refactoring webhook.ts (459 → 177 LOC)
- [x] 6 nuevos módulos creados
- [x] Environment validation (lib/env.ts)
- [x] Structured logging (lib/logger.ts)
- [x] Cron authentication
- [x] Follow-ups cron job configurado
- [x] 71/71 tests passing
- [x] Test files manuales creados
- [x] Pre-deployment checklist creado

### Pendiente ⚠️
- [ ] Configurar variables en Vercel Dashboard (producción)
- [ ] Ejecutar tests locales con `vercel dev`
- [ ] Deploy a preview para validación
- [ ] Configurar webhook URL en Meta
- [ ] RLS policies para producción (Fase 3)

### Issues Conocidos (No Bloqueantes)
- TypeScript errors en archivos legacy (lib/actions.ts, lib/openai.ts, lib/scheduling.ts)
- Estos archivos ya existían antes del refactoring
- No afectan runtime ni deployment
- Se corregirán en Fase 3

---

## 🎯 Next Steps

### Immediate (antes de deploy)
1. Configurar variables en Vercel Dashboard
2. Ejecutar `vercel dev` localmente
3. Correr `./test-all-endpoints.sh`
4. Verificar todos los tests pasan

### Deployment
```bash
# Preview
vercel

# Production (después de validar preview)
vercel --prod
```

### Post-Deployment
1. Configurar webhook URL en Meta Developer Console
2. Enviar mensaje de prueba desde WhatsApp
3. Monitorear logs en tiempo real
4. Verificar cron jobs ejecutan correctamente

---

## 📚 Referencias

- [tests/manual/QUICKSTART.md](tests/manual/QUICKSTART.md) - Guía rápida de testing
- [tests/manual/README.md](tests/manual/README.md) - Documentación completa de testing
- [docs/deployment/VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md](docs/deployment/VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md)
- [CLAUDE.md](CLAUDE.md) - Development rules

---

**Última actualización**: 2025-10-03
**Status**: ✅ Ready para testing local y deployment a preview
