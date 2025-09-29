# Kapso.ai → Equivalentes en Vercel + Supabase + OpenAI (sin Kapso)

Este reporte analiza la documentación de Kapso.ai y determina qué funcionalidades podemos implementar nativamente en este repositorio (arquitectura: WhatsApp Business API → Vercel Edge Functions → Supabase → OpenAI) sin depender de Kapso.

Referencias citadas:
- Introducción: [docs.kapso.ai/docs/introduction](https://docs.kapso.ai/docs/introduction)
- WhatsApp API: [docs.kapso.ai/api-reference/whatsapp-introduction](https://docs.kapso.ai/api-reference/whatsapp-introduction)
- Platform API: [docs.kapso.ai/api-reference/platform-introduction](https://docs.kapso.ai/api-reference/platform-introduction)
- Agents & Flows API: [docs.kapso.ai/api-reference/agents-introduction](https://docs.kapso.ai/api-reference/agents-introduction)
- Functions API: [docs.kapso.ai/api-reference/functions-introduction](https://docs.kapso.ai/api-reference/functions-introduction)

## 1) Resumen de capacidades Kapso
- **WhatsApp para developers**: envío/recepción, plantillas, sandbox, webhooks, contactos, conversaciones [Introducción, WhatsApp API].
- **Platform API**: multi-tenant (customers), setup links para que clientes conecten su propio WhatsApp, gestión de webhooks/configs [Platform API].
- **Agents & Flows**: definición/ejecución de agentes conversacionales y flujos; ejecuciones, snapshots, pruebas [Agents & Flows API].
- **Functions**: serverless gestionadas (Cloudflare Workers o Supabase Functions), despliegue e invocación centralizada [Functions API].

## 2) Mapeo a nuestra arquitectura (sin Kapso)
- Compute: Vercel Edge Functions (webhook, APIs, cron) y opcional Supabase Edge Functions.
- Datos: Supabase (PostgreSQL + RLS, tablas para `users`, `conversations`, `messages`, `reminders`, `documents`, `embeddings`).
- IA: OpenAI (GPT-4o para intención/respuesta; Whisper para audio; Embeddings para RAG).
- WhatsApp: API oficial de Meta (webhook de recepción + endpoints de envío), o proxy propio si aplica.

## 3) Funcionalidades replicables 1:1 o con pequeñas adaptaciones

### 3.1 WhatsApp API (Mensajería, plantillas, conversaciones, contactos)
- **Recepción de mensajes (webhook)**: Vercel Edge Function `/api/whatsapp/webhook` valida firmas y normaliza payloads. [Introducción, WhatsApp API]
- **Envío de mensajes**: Ruta `/api/whatsapp/send` que llama a la API de Meta (textos, imágenes, botones/interactive si aplica) con control de errores y reintentos. [WhatsApp API]
- **Plantillas**: Tabla `wa_templates` en Supabase + sincronización con Meta (o gestión mínima local) y endpoint `/api/whatsapp/templates` (listar, crear, enviar). [WhatsApp API]
- **Conversaciones y estados**: Tablas `conversations`, `messages` (índices por `user_id`/`wa_conversation_id`), endpoints para listar/actualizar estado (read, delivered). [WhatsApp API]
- **Contactos y notas**: Tablas `contacts`, `contact_notes` y endpoints CRUD correspondientes. [WhatsApp API]

### 3.2 Webhooks de plataforma
- **Gestión de webhooks**: Tabla `webhooks` (tipo, url, secreto, estado); endpoints para crear/listar/eliminar; firma HMAC en envíos salientes. [Platform API]

### 3.3 Multi-tenant básico (equivalente Platform API)
- **Customers**: Tabla `customers` (con `external_customer_id`), RLS por `customer_id`. [Platform API]
- **WhatsApp Configs**: Tabla `whatsapp_configs` por customer (tokens/IDs referenciados, nunca almacenados en claro; usar Vercel Env o KMS para secretos), health checks mediante endpoint `/api/wa/configs/health`. [Platform API]
- **Setup Links (análogo)**: Endpoint `/api/customers/{id}/setup-link` que genera enlace firmado a un flujo de onboarding para conectar WhatsApp (documentado en README); persiste estado en `customer_onboarding`. [Platform API]

### 3.4 Functions (equivalentes en nuestro stack)
- **Workers**: Usar Vercel Edge Functions (rápido y global) y, donde convenga DB cercana, Supabase Edge Functions. [Functions API]
- **Invocación**: Endpoints estandarizados `/api/functions/{name}` invocan lógicas específicas (desacople tipo dispatcher). [Functions API]
- **Secrets**: Variables de entorno Vercel + Supabase secrets. [Functions API]

### 3.5 Agents & Flows (núcleo mínimo)
- **Agentes**: Implementar servicio `AgentExecutor` que orquesta prompts/roles con OpenAI; persistir ejecuciones en `agent_executions` (estado, input/output, tiempos). [Agents & Flows API]
- **Flujos**: Modelo simple `flows` + `flow_nodes` + `flow_edges` (tipos: intent, tool, decision, send_message). Ejecutar en Vercel; usar JSON para definición. [Agents & Flows API]
- **Testing**: `agent_test_chats` y `test_suites` (mínimo viable) con seeds y playbooks básicos. [Agents & Flows API]

## 4) Funcionalidades a implementar por fases

### Fase A (MVP operativo)
- Webhook recepción + envío mensajes + almacenamiento Supabase.
- Detección de intención con OpenAI (timeout y límites) y respuesta de texto.
- Conversaciones, mensajes, contactos (CRUD), plantillas básicas.
- Recordatorios con Vercel Cron.

### Fase B (Productividad y medios)
- Audio: descarga a Supabase Storage, transcripción Whisper, resumen y respuesta.
- RAG PDFs: storage `documents`, embeddings OpenAI, retrieval y citas.
- Multi-tenant: `customers`, `whatsapp_configs`, RLS, health checks.

### Fase C (Flows/Agents + pruebas)
- Motor de flujos minimal: definición JSON, ejecución condicional, herramientas (Google Calendar, etc.).
- Agent executions y snapshots mínimos (guardar prompt/contexto). 
- Test suites básicas (escenarios happy/failure) y reportes.

## 5) Diseño de datos sugerido (tablas clave)
- `users(id, phone_number unique, name, preferences, created_at)`
- `customers(id, name, external_customer_id, created_at)`
- `whatsapp_configs(id, customer_id fk, meta_business_id, phone_id, status, created_at)`
- `conversations(id, user_id fk, customer_id fk, wa_conversation_id, status, created_at)`
- `messages(id, conversation_id fk, direction, type, content, media_url, wa_message_id, timestamp, created_at)`
- `contacts(id, customer_id fk, wa_phone, name, labels jsonb, created_at)`
- `contact_notes(id, contact_id fk, author, note, created_at)`
- `wa_templates(id, customer_id fk, name, language, category, content jsonb, status, synced_at)`
- `reminders(id, user_id fk, title, description, scheduled_time timestamptz, status, created_at)`
- `documents(id, user_id fk, bucket, path, metadata jsonb, created_at)`
- `embeddings(id, document_id fk, chunk_index, vector, metadata jsonb)`
- `webhooks(id, customer_id fk, event_type, target_url, secret, status, created_at)`
- `flows(id, customer_id fk, name, definition jsonb, version, created_at)`
- `agent_executions(id, agent_name, input jsonb, output jsonb, status, started_at, finished_at)`

## 6) Endpoints principales (Vercel Edge)
- `POST /api/whatsapp/webhook` (recepción, validación, encolado/opcional)
- `POST /api/whatsapp/send` (envío; soportar tipos básicos y plantillas)
- `GET /api/conversations/:id/messages` (paginado)
- `POST /api/templates` / `POST /api/templates/send`
- `POST /api/reminders/schedule` / `GET /api/reminders`
- `POST /api/documents/upload` / `POST /api/documents/ingest`
- `POST /api/ai/intent` / `POST /api/ai/answer` / `POST /api/ai/transcribe`
- `POST /api/flows/execute` (ejecutar definición JSON mínima)

## 7) Seguridad y límites
- **Auth**: Supabase Auth + RLS; firma HMAC en webhooks; sanitización de entradas.
- **Secrets**: Vercel Env + (opcional) KMS externo; nunca loggear secretos.
- **Rate limits**: Middleware por IP/user/conversation (Redis/Upstash opcional) y backoff en integraciones. [WhatsApp API, Platform API]
- **Observabilidad**: Logs estructurados (request_id), métricas (Vercel Analytics, Supabase logs).

## 8) Diferencias vs Kapso (y compensaciones)
- Sin consola Kapso ni sandbox gestionado: se reemplaza con seeds, scripts y entornos de preview en Vercel.
- Sin orquestación de funciones multi-plataforma centralizada: usamos Vercel Edge + Supabase Functions donde convenga.
- Sin builder visual de flujos/agentes: definiciones JSON y utilidades simples (más trabajo inicial, mayor control).

## 9) Recomendaciones prácticas
- Empezar con el **MVP (Fase A)** y validar latencia/estabilidad.
- Añadir **audio y RAG** en Fase B según demanda de usuarios.
- Incorporar **flows/agents mínimos** en Fase C para automatización avanzada.
- Mantener **tests determinísticos** y **RLS** activo desde el día 1.

## 10) Conclusión
Podemos replicar la mayoría de las capacidades clave de Kapso de forma nativa con Vercel + Supabase + OpenAI, priorizando:
1) Webhook/Send + persistencia y contexto conversacional.
2) Plantillas, contactos, conversaciones y recordatorios.
3) Audio (Whisper) y RAG (Embeddings + Storage) para valor diferencial.
4) Un motor mínimo de Flows/Agents y test suites incrementales.

El enfoque mantiene control de costos, baja latencia en edge y alineación total con la arquitectura del repositorio, sin vendor lock-in.
