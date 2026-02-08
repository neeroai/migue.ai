# Testing recurrente de webhook WhatsApp sin cambiar manualmente Meta UI

Este flujo permite testear ramas (preview) por CLI usando `override_callback_uri` en `/{WABA_ID}/subscribed_apps`.

## Problema
- Meta usa un callback principal de webhook.
- Si solo pruebas en `main`, los cambios en ramas no reciben tráfico real.
- Cambiar manualmente en UI cada vez es lento y propenso a errores.

## Solución CLI (este repo)
Script agregado:
- `scripts/wa-webhook-override.mjs`

Comandos:
- `npm run wa:webhook:status`
- `npm run wa:webhook:set -- --url <WEBHOOK_URL>`
- `npm run wa:webhook:reset`

## Variables necesarias
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`
- `WHATSAPP_VERIFY_TOKEN` (o `--verify-token`)
- `WHATSAPP_BUSINESS_ACCOUNT_ID` (recomendado; también puedes pasar `--waba-id`)

## Flujo recomendado para QA de rama
1. Obtener URL webhook de preview (ejemplo):
- `https://<deployment>.vercel.app/api/whatsapp/webhook`

2. Apuntar override al preview:
```bash
npm run wa:webhook:set -- --url https://<deployment>.vercel.app/api/whatsapp/webhook --waba-id <WABA_ID>
```

3. Probar por WhatsApp real.

4. Regresar a configuración por defecto:
```bash
npm run wa:webhook:reset
```

## Buenas prácticas
1. Mantener una rama/staging deployment estable para pruebas de webhook.
2. No dejar override activo más tiempo del necesario.
3. Registrar en checklist de release cuándo se activa y cuándo se resetea.

## Alternativa de largo plazo (más sólida)
- Usar un número/WABA de staging separado para no tocar producción.
