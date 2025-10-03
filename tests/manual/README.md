# Manual API Testing

Archivos para testing manual de endpoints antes de deployment a Vercel.

## Setup

```bash
# 1. Iniciar servidor local
npm run dev:vercel
# o
vercel dev
```

## Endpoints Disponibles

### 1. Webhook Verification (GET)
```bash
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"

# Resultado esperado: "test123"
```

### 2. Webhook Message - Text (POST)
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-payload.json
```

### 3. Webhook Message - Audio (POST)
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-audio.json
```

### 4. Webhook Message - Interactive Button (POST)
```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @webhook-interactive.json
```

### 5. Webhook con HMAC Signature
```bash
# Set WHATSAPP_APP_SECRET env var first
export WHATSAPP_APP_SECRET="your_secret"

# Run script
./test-webhook-signature.sh webhook-payload.json
```

### 6. Cron - Check Reminders
```bash
curl http://localhost:3000/api/cron/check-reminders
```

### 7. Cron - Follow-ups
```bash
curl http://localhost:3000/api/cron/follow-ups
```

### 8. Cron con Authentication (si CRON_SECRET configurado)
```bash
curl http://localhost:3000/api/cron/check-reminders \
  -H "Authorization: Bearer your_cron_secret"
```

## Archivos de Testing

- `webhook-payload.json` - Mensaje de texto básico (schedule intent)
- `webhook-audio.json` - Mensaje de audio/voice
- `webhook-interactive.json` - Button reply interaction
- `test-webhook-signature.sh` - Script para testing con HMAC signature

## Validaciones

### Respuestas Esperadas

**Webhook (éxito)**:
```json
{
  "success": true,
  "request_id": "xxx"
}
```

**Webhook (error de validación)**:
```json
{
  "error": "Invalid webhook payload",
  "request_id": "xxx",
  "issues": [...]
}
```

**Cron Reminders (sin recordatorios)**:
```json
{
  "processed": 0,
  "failures": []
}
```

**Cron Follow-ups (sin jobs)**:
```json
{
  "processed": 0,
  "sent": 0
}
```

## Debugging

### Ver logs estructurados
Los logs aparecen automáticamente en el terminal donde ejecutaste `vercel dev`, en formato JSON:

```json
{
  "level": "info",
  "message": "Request processed successfully",
  "timestamp": "2025-10-03T...",
  "service": "migue-ai",
  "environment": "development",
  "requestId": "xxx",
  "duration": 123
}
```

### Errores comunes

**"Invalid signature"**:
- Verifica que `WHATSAPP_APP_SECRET` esté configurado
- Signature se genera con el payload exacto (sin espacios extra)

**"Invalid environment configuration"**:
- Verifica que `.env.local` tenga todas las variables requeridas
- Ejecuta: `grep -E "WHATSAPP_TOKEN|SUPABASE_URL|OPENAI_API_KEY" .env.local`

**"Unauthorized" en cron endpoints**:
- Si `CRON_SECRET` está configurado, agregar header `Authorization: Bearer xxx`
- Para testing local, puedes dejar `CRON_SECRET` sin configurar

## Pre-Deployment Checklist

Antes de `vercel --prod`:

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm test` → 71/71 passing
- [ ] `vercel dev` inicia sin errores
- [ ] Webhook verify responde correctamente
- [ ] Webhook message procesa y responde 200
- [ ] Cron endpoints responden 200
- [ ] Logs estructurados funcionan
- [ ] Variables en Vercel Dashboard configuradas

## Tips

- Usa `jq` para formatear responses JSON: `curl ... | jq`
- HTTPie es más legible que curl: `brew install httpie`
- Postman/Insomnia para testing más visual
- `vercel logs` para ver logs de production
