# Testing recurrente de webhook WhatsApp sin cambiar manualmente Meta UI

Este flujo permite testear ramas (preview) por CLI sin entrar a Meta UI.
Modo recomendado: actualizar callback por `/{APP_ID}/subscriptions` (mode `app`).

## Problema
- Meta usa un callback principal de webhook.
- Si solo pruebas en `main`, los cambios en ramas no reciben tráfico real.
- Cambiar manualmente en UI cada vez es lento y propenso a errores.

## Solución CLI (este repo)
Script agregado:
- `scripts/wa-webhook-override.mjs`

Comandos:
- `npm run wa:webhook:status -- --mode app`
- `npm run wa:webhook:set -- --mode app --url <WEBHOOK_URL>`
- `npm run wa:webhook:reset -- --mode app`

## Variables necesarias
Modo recomendado (`app`):
- `WHATSAPP_APP_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN` (o `--verify-token`)
- `WHATSAPP_WEBHOOK_DEFAULT_URL` (para reset)

Modo alterno (`waba`):
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (o `--waba-id`)

## Flujo recomendado para QA de rama
1. Obtener URL webhook de preview (ejemplo):
- `https://<deployment>.vercel.app/api/whatsapp/webhook`

2. Apuntar override al preview:
```bash
npm run wa:webhook:set -- --mode app --url https://<deployment>.vercel.app/api/whatsapp/webhook
```

3. Probar por WhatsApp real.

4. Regresar a configuración por defecto:
```bash
npm run wa:webhook:reset -- --mode app
```

## Buenas prácticas
1. Mantener una rama/staging deployment estable para pruebas de webhook.
2. No dejar override activo más tiempo del necesario.
3. Registrar en checklist de release cuándo se activa y cuándo se resetea.

## Alternativa de largo plazo (más sólida)
- Usar un número/WABA de staging separado para no tocar producción.
