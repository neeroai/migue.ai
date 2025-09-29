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
- **IA/LLM**: OpenAI API (GPT-4o, Whisper, Embeddings)
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

- ✅ **Fase 1**: Documentación y análisis completado
- ✅ **Análisis de Mercado**: Completado
- ✅ **Análisis Competitivo**: Completado
- ✅ **Documentación Técnica**: Completado
- ✅ **Análisis de Arquitectura**: Completado
- ✅ **Deployment**: Producción activa en Vercel
- 🔄 **Fase 2**: Desarrollo de funcionalidades core (En progreso)
- ⏳ **Fase 3**: Desarrollo backend y frontend
- ⏳ **Fase 4**: Testing, despliegue y monitoreo

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
│   │   ├── webhook.ts              # Message reception
│   │   └── send.ts                 # Message sending
│   └── cron/                       # Scheduled tasks
│       └── check-reminders.ts      # Daily reminder checks
├── lib/                            # Shared utilities
│   ├── supabase.ts                 # Database client
│   └── persist.ts                  # Data persistence
├── types/                          # TypeScript definitions
│   └── env.d.ts                    # Environment variables
├── supabase/                       # Database schema
│   ├── schema.sql                  # Tables and types
│   └── security.sql                # RLS policies
├── docs/                           # Documentation
│   ├── setup.md                    # Setup instructions
│   ├── architecture.md             # Architecture docs
│   └── SUPABASE.md                 # Database docs
├── .cursor/                        # IDE rules
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
- [ ] Integración OpenAI básica (en progreso)
- [ ] Webhook completamente funcional con OpenAI

### Fase 2: Core Features (Mes 3-4) 🔄
- [ ] Transcripción de audios (Whisper API)
- [ ] Sistema de recordatorios (Vercel Cron)
- [ ] Gestión de calendarios (Google Calendar)
- [ ] RAG básico con embeddings + Supabase
- [ ] Reconocimiento de intención con GPT-4o

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

### Documentación Técnica
- [CLAUDE.md](./CLAUDE.md) - Guía para Claude Code
- [AGENTS.md](./AGENTS.md) - Blueprint del proyecto
- [docs/setup.md](./docs/setup.md) - Instrucciones de setup
- [docs/architecture.md](./docs/architecture.md) - Documentación de arquitectura
- [docs/SUPABASE.md](./docs/SUPABASE.md) - Documentación de base de datos

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

### Límites de Código
- Archivo: ≤ 300 LOC
- Función: ≤ 50 LOC
- Parámetros: ≤ 5
- Complejidad ciclomática: ≤ 10

## 📄 Licencia

[Definir licencia]

## 📞 Contacto

- **Proyecto**: migue.ai Personal Assistant
- **Estado**: En desarrollo - Fase 2 (Core Features)
- **Versión**: 1.1
- **Deployment**: ✅ Producción activa (https://migue.app)
- **Última actualización**: 2025-01-29

---

**Desarrollado con ❤️ para optimizar la productividad personal a través de IA conversacional**
