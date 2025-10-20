# 🤖 migue.ai - Personal AI Assistant

> Un asistente personal de inteligencia artificial que opera a través de WhatsApp Business API, proporcionando funcionalidades avanzadas de productividad, gestión de citas, análisis de contenido y automatización de tareas diarias.

## 🎯 Objetivo

Desarrollar un asistente personal de IA disponible 24/7 a través de WhatsApp Business API, que combine la utilidad de Zapia con la sofisticación técnica de Martin, enfocado en el mercado latinoamericano.

## ✨ Características Principales

### 🤝 Gestión de Citas y Reservas
- **Agendamiento 24/7**: Disponibilidad continua para reservas
- **Confirmaciones Automáticas**: Reducción de no-shows
- **Integración Calendario**: Sincronización con Google Calendar/Outlook
- **Recuperación de Cancelaciones**: Reprogramación automática

### 🎵 Análisis de Contenido Multimodal
- **Transcripción de Audio**: WhatsApp audios → texto
- **Resumen de Videos**: YouTube → resumen textual
 - **Análisis de PDFs**: RAG con embeddings OpenAI + metadata en Supabase
- **Interpretación de Imágenes**: Identificación de productos/información

### ⚡ Productividad Personal
- **Recordatorios Inteligentes**: Programación con Vercel Cron + Supabase
- **Gestión de Tareas**: Listas y seguimiento
- **Programación de Mensajes**: Envío diferido en WhatsApp
- **Búsqueda de Información**: Noticias, clima, datos en tiempo real

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
- **Frontend/Comunicación**: WhatsApp Business API
- **Backend**: Vercel Edge Functions (serverless)
- **Base de Datos**: Supabase PostgreSQL + Auth (RLS)
- **IA/LLM**: OpenAI API (GPT-4o-mini primary, Whisper audio, Claude fallback)
- **OCR**: Tesseract.js (free)
- **Almacenamiento**: Supabase Storage (archivos multimedia)
- **Programación**: Vercel Cron Jobs (recordatorios)
- **Seguridad**: Variables de entorno en Vercel + RLS en Supabase

### Arquitectura Recomendada
```
WhatsApp Business API → Vercel Edge Functions → Supabase → OpenAI API
```

## 📊 Análisis de Mercado

- **Mercado Objetivo**: 10K usuarios iniciales en Latinoamérica
- **Competidores**: Zapia (1M+ usuarios), Martin (premium), Meta AI
- **Propuesta de Valor**: Alta utilidad gratuita + latencia ultra-baja (1-2 segundos)

## 🚀 Estado del Proyecto

- ✅ **Fase 1**: MVP completado
  - ✅ Documentación y análisis
  - ✅ Arquitectura Vercel + Supabase
  - ✅ Deployment en producción
  - ✅ Edge Functions configuradas
- 🔄 **Fase 2**: Funcionalidades Core (60% completado)
  - ✅ Sistema de IA con GPT-4o
  - ✅ Intent classification (8 categorías)
  - ✅ Response generation contextual
  - ✅ Conversation history management
  - ✅ Database optimization (RLS 100x mejora)
  - ✅ Documentación completa Vercel 2025
  - ✅ **Testing Infrastructure**: Jest + Edge Runtime + 39 unit tests
  - ✅ **Zod Validation**: WhatsApp webhook schemas (types/schemas.ts)
  - ✅ **Type Safety**: 13 formatos de mensaje validados
  - 🔄 Audio transcription (Whisper) - En progreso
  - ✅ Calendar integration (Google Calendar)
  - ✅ Reminder automation (Supabase + WhatsApp cron)
  - 🔄 Streaming responses
- ⏳ **Fase 3**: Funcionalidades avanzadas
- ⏳ **Fase 4**: Escalamiento y optimización

### 🎉 Deployment Exitoso
- **URL**: https://migue.app (producción)
- **Status**: ✅ Ready
- **Build Time**: ~57 segundos
- **Edge Functions**: Todas funcionando correctamente
- **Último Deploy**: 2025-01-29

## 📁 Estructura del Proyecto

```
migue.ai/
├── api/                            # Vercel Edge Functions
│   ├── whatsapp/                   # Webhook and messaging
│   │   ├── webhook.ts              # Message reception + AI processing
│   │   └── send.ts                 # Message sending
│   └── cron/                       # Scheduled tasks
│       └── check-reminders.ts      # Daily reminder checks
├── lib/                            # Shared utilities
│   ├── supabase.ts                 # Database client
│   ├── persist.ts                  # Data persistence
│   ├── openai.ts                   # OpenAI client (Edge-compatible)
│   ├── intent.ts                   # Intent classification
│   ├── response.ts                 # Response generation
│   └── context.ts                  # Conversation history
├── types/                          # TypeScript definitions
│   └── env.d.ts                    # Environment variables
├── supabase/                       # Database schema
│   ├── schema.sql                  # Tables and types
│   ├── security.sql                # RLS policies
│   └── migrations/                 # Database migrations
│       └── 001_optimize_rls_indexes.sql
├── docs/                           # Documentation
│   ├── deployment/                 # Vercel deployment docs
│   │   └── README.md               # Deployment index
│   ├── VERCEL-EDGE-FUNCTIONS-GUIDE.md
│   ├── VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md
│   ├── VERCEL-STREAMING-AI-RESPONSES.md
│   ├── VERCEL-MONITORING-ANALYTICS.md
│   ├── VERCEL-WHATSAPP-BOT-ARCHITECTURE.md
│   ├── VERCEL-SUPABASE-INTEGRATION.md
│   ├── setup.md                    # Setup instructions
│   ├── architecture.md             # Architecture docs
│   └── SUPABASE.md                 # Database docs
├── .bmad-core/                     # ⚠️ CRITICAL: Never delete
├── .cursor/                        # IDE rules
├── .claude/                        # Claude configuration
├── CLAUDE.md                       # Claude Code guide
├── AGENTS.md                       # Project blueprint
└── README.md                       # Este archivo
```

## 💰 Modelo de Costos Actualizado

### Costos Fijos (Mensual)
- **Vercel Pro**: $20/mes (Edge Functions, Analytics, Cron)
- **Supabase Pro**: $25/mes (PostgreSQL + Auth + Storage)
- **Total Fijo**: $45/mes

### Costos Variables
- **OpenAI API**: $30-50/mes (estimado 10K usuarios activos)
  - GPT-4o: $15/1M tokens input, $60/1M tokens output
  - Whisper: $0.006/minuto de audio
  - Embeddings: $0.13/1M tokens
- **WhatsApp Templates**: $0.005-$0.08 por mensaje (fuera CSW)

### Estrategia de Optimización
- **Uso máximo de CSW**: 24h gratis por conversación
- **Entry Point Window**: 72h gratis con Click-to-WhatsApp
- **Caché de respuestas**: Reducir llamadas a OpenAI
- **Template monitoring**: Rastrear costos de mensajes facturables

**Total Estimado**: $75-120/mes (incluye WhatsApp y OpenAI)

## 🎯 Métricas de Éxito

### Técnicas
- **Latencia promedio**: < 1.5 segundos
- **Disponibilidad**: > 99.9%
- **Error rate**: < 1%
- **Throughput**: 1000+ mensajes/hora

### De Negocio
- **Usuarios activos**: Meta mensual
- **Retención**: > 70% después de 30 días
- **Satisfacción**: > 4.5/5 en feedback
- **Costo por usuario**: < $2/mes

## 🚀 Quick Start

### 1. Instalación
```bash
npm install
```

### 2. Configuración de Variables
Copia `.env.local.example` a `.env.local` y configura:
```bash
# WhatsApp Business API
WHATSAPP_TOKEN=tu_token
WHATSAPP_PHONE_ID=tu_phone_id
WHATSAPP_VERIFY_TOKEN=tu_verify_token
WHATSAPP_APP_SECRET=tu_app_secret

# Supabase
SUPABASE_URL=https://pdliixrgdvunoymxaxmw.supabase.co
SUPABASE_KEY=tu_supabase_key
SUPABASE_ANON_KEY=tu_anon_key

# OpenAI
OPENAI_API_KEY=tu_openai_key

# Configuración
TIMEZONE=America/Mexico_City
NODE_ENV=development
```

### 3. Setup de Base de Datos
```sql
-- Ejecutar en Supabase SQL Editor
\i supabase/schema.sql
\i supabase/security.sql
```

### 4. Desarrollo
```bash
npm run dev        # Servidor de desarrollo
npm run typecheck  # Verificación de tipos
npm run build      # Build de producción
```

### 5. Endpoints Disponibles
- `GET /api/whatsapp/webhook` - Verificación de webhook
- `POST /api/whatsapp/webhook` - Recepción de mensajes
- `POST /api/whatsapp/send` - Envío de mensajes
- `GET /api/cron/check-reminders` - Cron diario (9 AM UTC)

## 🗺️ Roadmap Detallado

### Fase 1: MVP (Mes 1-2) ✅
- [x] Configuración WhatsApp Business API
- [x] Arquitectura Vercel + Supabase
- [x] Schema de base de datos (sessions, messages, reminders)
- [x] Variables de entorno configuradas
- [x] Deployment exitoso en Vercel (producción)
- [x] Edge Functions con static imports
- [x] Webhook endpoint implementado
- [x] Sistema de recordatorios (cron diario)
- [x] Integración OpenAI completa (GPT-4o)
- [x] Webhook funcional con AI processing
- [x] Sistema de IA con intent classification
- [x] Database optimization (RLS 100x mejora)

### Fase 2: Core Features (Mes 3-4) 🔄 50%
- [x] Reconocimiento de intención con GPT-4o (8 categorías)
- [x] Response generation contextual con historial
- [x] Conversation history management
- [x] Documentación completa Vercel 2025 (6 guías)
- [x] Performance optimization (Edge < 100ms)
- [ ] Transcripción de audios (Whisper API)
- [x] Gestión de calendarios (Google Calendar)
- [ ] RAG básico con embeddings + Supabase
- [ ] Streaming de respuestas GPT-4o
- [x] Sistema de recordatorios completo

### Fase 3: Advanced (Mes 5-6) ⏳
- [ ] Agente autónomo para reservas
- [ ] Análisis avanzado de PDFs
- [ ] Dashboard de monitoreo (métricas)
- [ ] Integraciones múltiples (Outlook, Calendly)
- [ ] Sistema de notificaciones push

### Fase 4: Scale (Mes 7-8) ⏳
- [ ] Optimización de costos WhatsApp
- [ ] Monitoreo avanzado (alertas, KPIs)
- [ ] Rate limiting y seguridad
- [ ] Testing automatizado (e2e)
- [ ] Preparación para producción

## ⚙️ Configuración Actual

### APIs Configuradas ✅
- **WhatsApp Business API**: Token y Phone ID configurados
- **Supabase**: https://pdliixrgdvunoymxaxmw.supabase.co (activo)
- **OpenAI API**: GPT-4o, Whisper, Embeddings disponibles
- **Vercel**: Edge Functions y Cron Jobs activos
  - **Production URL**: https://migue.app
  - **Deployment**: ✅ Successful (Build: ~57s)
  - **Cron**: check-reminders (daily at 9 AM UTC)

### Base de Datos 🗄️
- **Tablas**: sessions, messages, reminders (schema.sql)
- **Seguridad**: RLS habilitado en todas las tablas
- **Extensiones**: pgcrypto, pg_trgm configuradas
- **Tipos**: Enums personalizados para estados y direcciones

## 🧪 Testing & Seguridad

### Testing Strategy
- **Unit Tests**: Jest/Vitest para lógica de negocio
- **Integration Tests**: Supertest para APIs
- **E2E Tests**: Playwright para flujos completos
- **Coverage**: Mínimo 80% para módulos críticos

### Security Features
- **RLS**: Row Level Security en todas las tablas
- **Webhook Validation**: Signature verification con APP_SECRET
- **Input Sanitization**: Validación en todos los endpoints
- **Environment**: Variables seguras en Vercel (nunca en código)
- **Rate Limiting**: Middleware de Vercel Edge

## 📚 Documentación

### Documentación del Proyecto
- [CLAUDE.md](./CLAUDE.md) - Guía para Claude Code
- [AGENTS.md](./AGENTS.md) - Blueprint del proyecto
- [docs/setup.md](./docs/setup.md) - Instrucciones de setup
- [docs/architecture.md](./docs/architecture.md) - Documentación de arquitectura
- [docs/SUPABASE.md](./docs/SUPABASE.md) - Documentación de base de datos

### Documentación Vercel 2025 (Nuevo) 🆕
- **[docs/deployment/README.md](./docs/deployment/README.md)** - Índice completo de deployment
- [VERCEL-EDGE-FUNCTIONS-GUIDE.md](./docs/VERCEL-EDGE-FUNCTIONS-GUIDE.md) - Edge Functions completo
- [VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md](./docs/VERCEL-DEPLOYMENT-BEST-PRACTICES-2025.md) - Best practices
- [VERCEL-STREAMING-AI-RESPONSES.md](./docs/VERCEL-STREAMING-AI-RESPONSES.md) - Streaming GPT-4o
- [VERCEL-MONITORING-ANALYTICS.md](./docs/VERCEL-MONITORING-ANALYTICS.md) - Observabilidad
- [VERCEL-WHATSAPP-BOT-ARCHITECTURE.md](./docs/VERCEL-WHATSAPP-BOT-ARCHITECTURE.md) - Arquitectura bot
- [VERCEL-SUPABASE-INTEGRATION.md](./docs/VERCEL-SUPABASE-INTEGRATION.md) - Integración Supabase

### APIs Externas
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)

## 🤝 Contribución

Este proyecto sigue las mejores prácticas definidas en [AGENTS.md](./AGENTS.md). Para contribuir:

### Estándares de Desarrollo
1. **Lectura completa**: Lee archivos completos antes de modificar
2. **Commits pequeños**: Mantén cambios pequeños y seguros
3. **Documentar suposiciones**: Registra decisiones en Issues/PRs
4. **Testing**: Incluye tests para nuevo código
5. **Seguridad**: Nunca commitear secretos
6. **⚠️ CRÍTICO: NUNCA eliminar `.bmad-core/`** - Contiene configuración esencial

### Límites de Código
- Archivo: ≤ 300 LOC
- Función: ≤ 50 LOC
- Parámetros: ≤ 5
- Complejidad ciclomática: ≤ 10

## 📄 Licencia

[Definir licencia]

## 📞 Contacto

- **Proyecto**: migue.ai Personal Assistant
- **Estado**: En desarrollo - Fase 2 (Core Features - 50% completado)
- **Versión**: 1.2
- **Deployment**: ✅ Producción activa (https://migue.app)
- **Última actualización**: 2025-10-03

### 🎉 Logros Recientes
- ✅ Sistema de IA con GPT-4o implementado (intent classification + response generation)
- ✅ Documentación completa de Vercel 2025 (6 guías técnicas + índice)
- ✅ Optimización de base de datos (RLS indexes 100x mejora)
- ✅ Edge Functions optimizadas (latencia < 100ms)

---

**Desarrollado con ❤️ para optimizar la productividad personal a través de IA conversacional**
