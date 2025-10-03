# Quick Start - API Testing Local

Guía rápida para testear la API localmente antes de deployment.

## 🚀 Inicio Rápido (3 pasos)

### 1. Iniciar servidor local
```bash
cd /Users/mercadeo/neero/migue.ai
npm run dev:vercel
```

**Espera a ver**: `Ready! Available at http://localhost:3000`

### 2. En otra terminal, ejecutar tests
```bash
cd tests/manual
./test-all-endpoints.sh
```

### 3. Ver resultados
```
🧪 migue.ai - API Testing Suite
=================================
✓ PASS - Webhook verification
✓ PASS - Text message
✓ PASS - Audio message
...
📊 All tests passed! 🎉
```

---

## 📝 Tests Manuales Individuales

### Test 1: Verificar webhook
```bash
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TEST&hub.challenge=abc123"
```
**Esperado**: `abc123`

### Test 2: Mensaje de texto
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-payload.json
```
**Esperado**: `{"success":true,"request_id":"..."}`

### Test 3: Mensaje de audio
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-audio.json
```
**Esperado**: `{"success":true,"request_id":"..."}`

### Test 4: Botón interactivo
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-interactive.json
```
**Esperado**: `{"success":true,"request_id":"..."}`

### Test 5: Cron de reminders
```bash
curl http://localhost:3000/api/cron/check-reminders
```
**Esperado**: `{"processed":0,"failures":[]}`

### Test 6: Cron de follow-ups
```bash
curl http://localhost:3000/api/cron/follow-ups
```
**Esperado**: `{"processed":0,"sent":0}`

---

## 🔍 Verificar Logs Estructurados

Los logs aparecen automáticamente en la terminal de `vercel dev`:

```json
{
  "level": "info",
  "message": "Request processed",
  "timestamp": "2025-10-03T...",
  "service": "migue-ai",
  "requestId": "xxx",
  "duration": 123
}
```

---

## ✅ Pre-Deployment Checklist

Antes de `vercel --prod`:

- [ ] `npm test` → 71/71 passing
- [ ] Todos los tests manuales pasan
- [ ] No errores en logs de `vercel dev`
- [ ] Variables de entorno en Vercel Dashboard
- [ ] `vercel.json` tiene ambos cron jobs

---

## 🐛 Troubleshooting

**Error: "Address already in use"**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev:vercel
```

**Error: "WHATSAPP_TOKEN is required"**
```bash
# Verificar .env.local existe
ls -la .env.local

# Verificar variables
grep WHATSAPP_TOKEN .env.local
```

**Logs no se ven estructurados**
- Normal en desarrollo
- Vercel Dev puede simplificar el output
- En producción se verán en formato JSON completo

---

## 🎯 Next Steps

1. ✅ Tests locales pasan → Continuar con deployment
2. ❌ Tests fallan → Revisar logs y corregir
3. 🚀 Ready → `vercel --prod`

