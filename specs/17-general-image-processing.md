# 17 - General Image Processing (Multimodal)

## Status

`done`

## Objetivo

Implementar un pipeline multimodal general para `image` y `document` en WhatsApp, reemplazando OCR local y soportando:

- imagenes naturales
- documentos con texto
- recibos/facturas
- formularios/IDs

Con respuesta clara al usuario, timeout controlado y ruta especial cuando se detecta intencion de tools/features.

## Alcance

- Sustituir `tesseract.js` por analisis multimodal remoto.
- Clasificacion inicial por tipo de input visual.
- Extraccion de texto + respuesta en una sola llamada multimodal.
- Delegacion a ruta de tools cuando hay `tool intent` en caption o texto extraido.

## Arquitectura

### 1) Orquestacion de entrada

Archivo: `src/modules/webhook/application/input-orchestrator.ts`

- Mantiene timeout por `image/document`.
- Mantiene mensajes de progreso al usuario durante procesamiento largo.

### 2) Pipeline visual

Archivo: `src/modules/ai/application/vision-pipeline.ts`

- `classifyVisualInput(...)`: clasificacion ligera (`DOCUMENT_TEXT`, `RECEIPT_INVOICE`, `ID_FORM`, `GENERAL_IMAGE`).
- `analyzeVisualInput(...)`: llamada multimodal via AI SDK (`generateObject`) con imagen + prompt por clase.
- Salida estandar:
  - `responseText`
  - `extractedText`
  - `toolIntentDetected`
  - `inputClass`

### 3) Integracion con AI principal

Archivo: `src/modules/ai/application/processing.ts`

- `processDocumentMessage(...)` ahora:
  1. descarga media
  2. ejecuta `analyzeVisualInput`
  3. persiste texto extraido
  4. si detecta `tool intent`, delega a `processMessageWithAI(...)`
  5. si no, responde directo con `responseText`

## Decisiones y tradeoffs

- Se prioriza multimodal cloud sobre OCR local:
  - Pros: mejor calidad semantica, soporte imagen general, compatible con runtime de despliegue.
  - Tradeoff: costo por token y dependencia de proveedor.
- Clasificacion inicial heuristica:
  - Pros: simple, rapida, determinista.
  - Tradeoff: menor precision que un clasificador LLM dedicado.

## Criterios de validacion

1. Imagen natural: respuesta util sin error generico.
2. Documento/recibo: extrae texto o datos clave y responde con resumen.
3. Caso con intencion (`recuérdame`, `agenda`, etc.) en caption + imagen: delega al flujo de tools.
4. Sin regresion en timeout/mensajes de progreso de rich input.
5. Build/typecheck en verde.
6. Validacion manual en produccion con los casos del runbook (seccion siguiente).

## Runbook QA Produccion

1. Imagen general (foto sin texto)
- Input: foto normal con caption `"que ves aqui?"`
- Esperado:
  - mensaje inmediato de procesamiento
  - respuesta util sobre la imagen
  - log `[VisionPipeline] Visual analysis completed`

2. Documento con texto
- Input: foto/PDF con caption `"resumeme este documento"`
- Esperado:
  - respuesta con resumen
  - clasificacion visual `DOCUMENT_TEXT`

3. Factura/recibo
- Input: recibo/factura con caption `"analiza esta factura"`
- Esperado:
  - resumen con datos clave
  - clasificacion visual `RECEIPT_INVOICE`

4. Imagen + intencion de tool
- Input: imagen + caption `"recuérdame pagar esta factura mañana a las 9am"`
- Esperado:
  - `toolIntentDetected: true`
  - delegacion a `processMessageWithAI(... pathway: rich_input)`
  - confirmacion correcta de accion (sin error generico)

## Go / No-Go

- GO: pasan los 4 casos y no aparecen errores WhatsApp 4xx/5xx de payload.
- GO: no aparece `"The parameter text['body'] is required"`.
- NO-GO: hay timeouts frecuentes de rich input o fallback recurrente a error generico.

## Pendientes

- Agregar pruebas unitarias de prompts por clase visual.
- Agregar prueba de integracion para ruta `toolIntentDetected` desde imagen/documento.
- Definir politica de redaccion de PII para inputs tipo `ID_FORM`.

## Cierre

- Fecha cierre: `2026-02-07`
- Resultado: pipeline multimodal activo en produccion, validado con pruebas manuales y sin regresion del error de payload de WhatsApp.
- Nota: los pendientes quedan como backlog para una siguiente iteracion.
