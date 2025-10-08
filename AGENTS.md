# AGENTS.md - migue.ai Personal Assistant

## Descripción del Proyecto

### Objetivo Principal
Desarrollar un asistente personal de inteligencia artificial (migue.ai) que opere a través de WhatsApp Business API, proporcionando funcionalidades avanzadas de productividad, gestión de citas, análisis de contenido y automatización de tareas diarias.

### Alcance del Proyecto
- **Asistente Personal Completo**: Más allá de un simple chatbot, migue.ai debe actuar como un agente de IA disponible 24/7
- **Integración WhatsApp Business**: Utilización de la API oficial de WhatsApp Business para comunicación
 - **Arquitectura Serverless Moderna**: Vercel Edge Functions + Supabase + OpenAI
- **Funcionalidades Multimodales**: Procesamiento de texto, audio, documentos PDF e imágenes
- **Automatización de Tareas**: Gestión de calendarios, recordatorios, reservas y citas

### Audiencia Objetivo
- **Usuarios Individuales**: Profesionales y personas que buscan optimizar su productividad personal
- **Pequeñas Empresas**: Negocios que requieren automatización de agendamiento de citas
- **Mercado Latinoamericano**: Enfoque inicial en usuarios de habla hispana

## Contexto del Negocio

### Situación Actual
El mercado de asistentes personales de IA en WhatsApp está en rápida expansión, con competidores como Zapia (1M+ usuarios en LatAm), Martin (asistente premium), y Meta AI (nativo de WhatsApp). La oportunidad radica en crear una solución que combine la utilidad de Zapia con la sofisticación técnica de Martin.

### Necesidades Identificadas
1. **Gestión de Citas Avanzada**: Automatización completa del ciclo de vida de citas
2. **Análisis de Contenido**: Transcripción de audios, resumen de videos/PDFs
3. **Productividad Personal**: Recordatorios, programación de mensajes, gestión de tareas
4. **Integración de Ecosistemas**: Conectividad con Google Calendar, CRM, sistemas empresariales

### Propuesta de Valor
- **Alta Utilidad Gratuita**: Maximizar funcionalidades dentro de la Ventana de Servicio al Cliente (CSW) de 24 horas
- **Latencia Ultra-Baja**: Respuestas en 1-2 segundos para experiencia conversacional fluida
- **Agente Autónomo**: Capacidad de ejecutar tareas en el mundo real, no solo responder preguntas

## Metodología de Desarrollo

### Arquitectura Técnica

#### Stack Tecnológico Principal
- **Frontend/Comunicación**: WhatsApp Business API
- **Backend**: Vercel Edge Functions (serverless)
- **Base de Datos**: Supabase PostgreSQL + Auth (contexto conversacional con RLS)
- **IA/LLM Multi-Provider** (76% cost savings):
  - **Primary**: Claude Sonnet 4.5 (chat, agents)
  - **Audio**: Groq Whisper (transcription)
  - **OCR**: Tesseract (free image text extraction)
  - **Fallback**: OpenAI API (backwards compatibility)
- **Almacenamiento**: Supabase Storage (archivos multimedia)
- **Programación**: Vercel Cron Jobs (recordatorios)
- **Seguridad**: Vercel Env + RLS (Supabase) para control de acceso
- **Integraciones**: Model Context Protocol (MCP)

#### Flujo de Mensajes V2 (Multi-Provider)
1. **Recepción**: Webhook en Vercel Edge Function
2. **Selección de Provider**: AIProviderManager decide según costo/tarea
3. **Procesamiento**:
   - **Chat**: Claude Sonnet 4.5 con agentes especializados
   - **Audio**: Groq Whisper → transcripción → Claude
   - **Imágenes/PDFs**: Tesseract OCR → Claude comprensión
4. **Persistencia**: Supabase (contexto + tracking de costos)
5. **Generación**: Claude Agents (ProactiveAgent, SchedulingAgent, FinanceAgent)
6. **Envío**: WhatsApp Business API
7. **Monitoreo**: Cost tracking y budget management

### Funcionalidades Core

#### 1. Gestión de Citas y Reservas
- **Agendamiento 24/7**: Disponibilidad continua para reservas
- **Confirmaciones Automáticas**: Reducción de no-shows
- **Recuperación de Cancelaciones**: Reprogramación automática
- **Integración Calendario**: Sincronización con Google Calendar/Outlook

#### 2. Análisis de Contenido Multimodal
- **Transcripción de Audio**: WhatsApp audios → texto
- **Resumen de Videos**: YouTube → resumen textual
 - **Análisis de PDFs**: RAG con embeddings OpenAI + metadata en Supabase
- **Interpretación de Imágenes**: Identificación de productos/información

#### 3. Productividad Personal
 - **Recordatorios Inteligentes**: Programación con Vercel Cron + Supabase
- **Gestión de Tareas**: Listas y seguimiento
- **Programación de Mensajes**: Envío diferido en WhatsApp
- **Búsqueda de Información**: Noticias, clima, datos en tiempo real

### Estrategia de Costos WhatsApp

#### Modelo de Precios (Post-Julio 2025)
- **Mensajes de Servicio**: Gratuitos dentro de CSW (24h)
- **Plantillas de Utilidad**: Facturables fuera de CSW
- **Plantillas de Marketing**: Siempre facturables
- **Ventana de Punto de Entrada**: 72h gratuitas con Click-to-WhatsApp

#### Optimización de Costos
- **Maximizar CSW**: Alta utilidad para mantener ventana activa
- **Minimizar Plantillas**: Uso estratégico de recordatorios asíncronos
- **Monitoreo Continuo**: Tracking de costos de plantillas Utility

## Estructura de Documentación

### Secciones Requeridas
1. **Arquitectura Técnica**: Diagramas y especificaciones técnicas
2. **APIs e Integraciones**: Documentación de endpoints y flujos
3. **Funcionalidades**: Especificaciones detalladas por módulo
4. **Despliegue**: Guías de implementación y configuración
5. **Monitoreo**: Métricas, logs y alertas
6. **Seguridad**: Políticas y mejores prácticas

### Formato de Presentación
- **Markdown**: Documentación principal en formato estándar
- **Diagramas Mermaid**: Arquitectura y flujos de proceso
- **Código**: Ejemplos en Python/TypeScript con sintaxis highlighting
- **Tablas**: Comparativas y especificaciones técnicas

### Nivel de Detalle Esperado
- **Alto**: Arquitectura, seguridad, integraciones críticas
- **Medio**: Funcionalidades, APIs, configuración
- **Bajo**: Ejemplos, casos de uso, documentación de usuario

## Estándares de Desarrollo

### Reglas Obligatorias
- **Lectura Completa**: Antes de cambiar cualquier cosa, leer los archivos relevantes de principio a fin, incluyendo todas las rutas de llamada/referencia
- **Cambios Pequeños**: Mantener tareas, commits y PRs pequeños y seguros
- **Documentación de Suposiciones**: Si se hacen suposiciones, registrarlas en Issue/PR/ADR
- **Seguridad de Secretos**: Nunca commitear o logear secretos; validar todas las entradas y codificar/normalizar salidas
- **Nombres Intencionados**: Evitar abstracciones prematuras y usar nombres que revelen la intención
- **Comparación de Opciones**: Comparar al menos dos opciones antes de decidir

### Mentalidad de Desarrollo
- **Pensar como Senior Engineer**: No saltar a conclusiones o apresurarse
- **Evaluar Múltiples Enfoques**: Escribir una línea cada uno para pros/contras/riesgos, luego elegir la solución más simple

### Reglas de Código y Archivos
- **Lectura Exhaustiva**: Leer archivos completamente de principio a fin (no lecturas parciales)
- **Análisis Previa**: Antes de cambiar código, localizar y leer definiciones, referencias, sitios de llamada, tests relacionados, docs/config/flags
- **Contexto Completo**: No cambiar código sin haber leído todo el archivo
- **Impacto Documentado**: Antes de modificar un símbolo, ejecutar búsqueda global para entender pre/postcondiciones y dejar nota de impacto de 1-3 líneas

### Reglas de Codificación Requeridas
- **Problem 1-Pager**: Antes de codificar, escribir: Contexto / Problema / Objetivo / No-Objetivos / Restricciones
- **Límites Enforzados**: 
  - Archivo ≤ 300 LOC
  - Función ≤ 50 LOC  
  - Parámetros ≤ 5
  - Complejidad ciclomática ≤ 10
  - Si se excede, dividir/refactorizar
- **Código Explícito**: Preferir código explícito; no "magia" oculta
- **DRY con Moderación**: Seguir DRY, pero evitar abstracciones prematuras
- **Aislamiento de Efectos**: Aislar efectos secundarios (I/O, red, estado global) en la capa límite
- **Manejo de Excepciones**: Capturar solo excepciones específicas y presentar mensajes claros al usuario
- **Logging Estructurado**: Usar logging estructurado y no logear datos sensibles (propagar request/correlation IDs cuando sea posible)
- **Zonas Horarias**: Considerar zonas horarias y DST

### Reglas de Testing
- **Cobertura Obligatoria**: Código nuevo requiere tests nuevos; bug fixes deben incluir test de regresión (escribirlo para fallar primero)
- **Tests Determinísticos**: Tests deben ser determinísticos e independientes; reemplazar sistemas externos con fakes/contract tests
- **Caminos de Prueba**: Incluir ≥1 camino feliz y ≥1 camino de falla en tests e2e
- **Evaluación de Riesgos**: Evaluar proactivamente riesgos de concurrencia/locks/retries (duplicación, deadlocks, etc.)

### Reglas de Seguridad
- **Sin Secretos**: Nunca dejar secretos en código/logs/tickets
- **Validación de Entradas**: Validar, normalizar y codificar entradas; usar operaciones parametrizadas
- **Principio de Menor Privilegio**: Aplicar el Principio de Menor Privilegio

### Reglas de Código Limpio
- **Nombres Intencionados**: Usar nombres que revelen la intención
- **Una Función, Una Tarea**: Cada función debe hacer una cosa
- **Efectos en el Límite**: Mantener efectos secundarios en el límite
- **Guard Clauses**: Preferir guard clauses primero
- **Constantes Simbolizadas**: Simbolizar constantes (no hardcodear)
- **Estructura Input → Process → Return**: Estructurar código como Entrada → Proceso → Retorno
- **Errores Específicos**: Reportar fallas con errores/mensajes específicos
- **Tests como Ejemplos**: Hacer que los tests sirvan como ejemplos de uso; incluir casos límite y de falla

### Anti-Patrones
- **No Modificar Sin Contexto**: No modificar código sin leer todo el contexto
- **No Exponer Secretos**: No exponer secretos
- **No Ignorar Fallas**: No ignorar fallas o warnings
- **No Optimización Injustificada**: No introducir optimización o abstracción injustificada
- **No Excepciones Amplias**: No usar excepciones amplias en exceso

## Instrucciones para Agentes

### Tareas Específicas

#### Desarrollo de Funcionalidades
1. **Implementar módulos siguiendo arquitectura serverless en Vercel Edge Functions**
2. **Optimizar latencia a objetivo de 1-2 segundos**
3. **Implementar manejo robusto de errores y logging**
4. **Seguir principios de clean code y testing**

#### Integración WhatsApp
1. **Configurar webhook de WhatsApp Business API**
2. **Implementar autenticación y validación de mensajes**
3. **Manejar diferentes tipos de mensajes (texto, audio, imagen, documento)**
4. **Optimizar uso de mensajes interactivos (List Messages, Quick Reply)**

#### Gestión de IA/LLM
1. **Configurar OpenAI (GPT-4o/Whisper/Embeddings) con límites y timeouts**
2. **Implementar RAG con embeddings de OpenAI y almacenamiento en Supabase**
3. **Optimizar prompts para reconocimiento de intención**
4. **Manejar contexto conversacional en Supabase (PostgreSQL, RLS)**

### Limitaciones y Restricciones

#### Técnicas
- **Latencia máxima**: 2 segundos para respuestas
- **Tamaño de archivos**: Límites de WhatsApp API
- **Límites de rate**: Respeta límites de APIs externas
- **Almacenamiento**: Optimizar uso de Supabase (DB/Storage)

#### De Negocio
- **Costo WhatsApp**: Monitorear plantillas facturables
- **Privacidad**: Cumplir GDPR y regulaciones locales
- **Disponibilidad**: Mantener servicio 24/7
- **Escalabilidad**: Soportar crecimiento de usuarios

#### De Seguridad
- **Credenciales**: Nunca hardcodear en código
- **Validación**: Sanitizar todas las entradas
- **Auditoría**: Log todas las acciones críticas
- **Encriptación**: Usar KMS para datos sensibles

### Criterios de Calidad

#### Código
- **Test Coverage**: Mínimo 80% para módulos críticos
- **Linting**: Pasar todas las reglas de ESLint/Pylint
- **Documentación**: Comentarios JSDoc/Python docstrings
- **Performance**: Respuesta < 2 segundos

#### Funcionalidad
- **Precisión**: > 95% en reconocimiento de intención
- **Disponibilidad**: 99.9% uptime
- **Escalabilidad**: Soportar 1000+ usuarios concurrentes
- **Usabilidad**: Interfaz conversacional natural

## Recursos y Referencias

### Documentación Técnica
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
 - [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
 - [Supabase Documentation](https://supabase.com/docs)
 - [OpenAI API Documentation](https://platform.openai.com/docs)

- Supabase Project URL: `https://pdliixrgdvunoymxaxmw.supabase.co`

### Investigación de Mercado
- [Investigación Asistente WhatsApp AWS.md](./docs/Investigación%20Asistente%20WhatsApp%20AWS.md)
- [Asistentes IA WhatsApp para Citas.md](./docs/Asistentes%20IA%20WhatsApp%20para%20Citas_.md)
- [agents-md-best-practices.md](./docs/agents-md-best-practices.md)

### Herramientas de Desarrollo
- **IDE**: VS Code con extensiones Vercel, Supabase, TypeScript/Python
- **Testing**: Jest (Node.js), Pytest (Python)
- **CI/CD**: GitHub Actions
- **Monitoring**: Vercel Analytics, Supabase logs
- **Documentation**: Markdown, Mermaid diagrams

### APIs y Servicios Externos
- **WhatsApp Business**: API oficial de Meta
- **Google Calendar**: Para gestión de citas
- **OpenAI**: GPT-4o (chat), Whisper (audio), Embeddings (RAG)
- **Supabase**: PostgreSQL, Auth, Storage
- **Vercel**: Edge Functions y Cron Jobs
- **Calendly**: Integración opcional para agendamiento

## Contacto y Soporte

### Responsables del Proyecto
- **Product Owner**: [Definir responsable]
- **Tech Lead**: [Definir responsable]
- **DevOps**: [Definir responsable]

### Canales de Comunicación
- **Issues**: GitHub Issues para bugs y features
- **Discussions**: GitHub Discussions para consultas técnicas
- **Slack/Teams**: [Definir canal de comunicación]
- **Email**: [Definir email de contacto]

### Proceso de Escalación
1. **Nivel 1**: Issues técnicos → Tech Lead
2. **Nivel 2**: Decisiones de producto → Product Owner
3. **Nivel 3**: Problemas críticos → [Definir escalación]

## Roadmap y Fases

### Fase 1: MVP (Mes 1-2) ✅
- [x] Configuración básica de WhatsApp Business API y webhook en Vercel
- [x] Implementación de arquitectura Vercel Edge Functions + Supabase
- [x] Deployment exitoso en producción (Vercel)
- [x] Edge Functions con static imports funcionando correctamente
- [x] Funcionalidades básicas: texto, reconocimiento de intención con OpenAI
- [x] Integración con OpenAI para respuestas (GPT-4o)
- [x] Sistema de IA con intent classification (8 categorías)
- [x] Generación de respuestas contextuales con historial
- [x] Database optimization con RLS indexes (100x mejora)

### Fase 2: Funcionalidades Core (Mes 3-4) 🚀 90%
- [x] Sistema de intent classification con GPT-4o
- [x] Response generation contextual
- [x] Conversation history management
- [x] Documentación completa de Vercel (6 guías + índice)
- [x] Optimización de performance (Edge Functions < 100ms)
- [x] **Testing Infrastructure**: Jest + Edge Runtime + 225 unit tests
- [x] **Zod Validation**: WhatsApp webhook schemas completos (types/schemas.ts)
- [x] **Type Safety**: Validación de 13 formatos de mensaje WhatsApp
- [x] **Multi-Provider AI System** - 76% cost reduction:
  - [x] Claude Sonnet 4.5 para chat principal
  - [x] Groq Whisper para transcripción (93% más barato)
  - [x] Tesseract para OCR gratuito
  - [x] OpenAI como fallback
- [x] **Specialized AI Agents**:
  - [x] ProactiveAgent: Asistente conversacional autónomo
  - [x] SchedulingAgent: Gestión autónoma de citas con ejecución directa
  - [x] FinanceAgent: Control proactivo de gastos
- [x] **Autonomous Actions**: Ejecución directa sin confirmación manual
- [x] **Error Recovery System**: Retry logic + duplicate detection
- [x] **Intelligent Follow-ups**: Context-aware con conversation history
- [x] **Cost Tracking**: Budget management y alertas
- [ ] Gestión de calendarios (Google Calendar) - 80%
- [ ] Sistema de recordatorios completamente funcional - 90%
- [ ] Model Context Protocol (MCP) para integraciones - 50%
- [ ] Análisis avanzado de documentos (RAG) - 60%

### Fase 3: Avanzado (Mes 5-6)
- [ ] Agente autónomo para reservas (Zapia Conecta style)
- [ ] Análisis de PDFs con RAG (Embeddings + Supabase Storage)
- [ ] Integración con múltiples calendarios
- [ ] Dashboard de monitoreo (Vercel Analytics + métricas de Supabase)

### Fase 4: Escalamiento (Mes 7-8)
- [ ] Optimización de costos
- [ ] Monitoreo avanzado (alertas/KPIs en Vercel/Supabase)
- [ ] Integraciones adicionales
- [ ] Preparación para lanzamiento

## Métricas de Éxito

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

### De Producto
- **Funcionalidades utilizadas**: Diversidad de uso
- **Tiempo de respuesta**: Eficiencia del asistente
- **Precisión de intención**: > 95%
- **Tasa de finalización**: > 80% en tareas complejas

---

**Fecha de creación**: 2025-01-27
**Última actualización**: 2025-10-07
**Versión**: 2.1 - WhatsApp v23.0 Full Support
**Estado**: En desarrollo - Fase 2 (Core Features + AI Migration - Progreso 95%)
**Deployment**: ✅ Producción activa en Vercel

**Últimos Logros (2025-10-07 - WhatsApp v23.0 Message Types Fix)** 🔧:
- ✅ **Auditoría de Usuarios**:
  - Script de diagnóstico (`npm run audit:users`)
  - Identificación de causa raíz: enum `msg_type` incompleto
  - 2 de 4 usuarios afectados (0 mensajes persistidos)
- ✅ **Fix de Persistencia de Mensajes**:
  - Agregados tipos WhatsApp v23.0: `sticker`, `reaction`, `order`
  - Removido tipo inválido `voice` (voice messages son `type='audio'`)
  - Type-safe validation con fallback a `'unknown'`
  - Enhanced error logging (enum violations, type mismatches)
- ✅ **Migración SQL**:
  - `supabase/migrations/002_add_whatsapp_v23_message_types.sql`
  - Ejecutada en producción (Supabase Dashboard)
- ✅ **Código Actualizado**:
  - `lib/persist.ts`: Validación type-safe con VALID_MSG_TYPES
  - `lib/message-normalization.ts`: Fix voice, add sticker/reaction/order
  - `types/schemas.ts`: Schemas actualizados (OrderContentSchema)
  - `app/api/whatsapp/webhook/route.ts`: Audio/voice check corregido
- ✅ **Herramientas de Diagnóstico**:
  - `scripts/audit-users.ts`: Análisis completo de interacciones
  - `audit-report.json`: Reporte exportable con métricas
- ✅ **Status**: Fix aplicado, pendiente de deployment para nuevos mensajes

**Logros Previos (2025-10-06 - Autonomous AI Actions)** ⚡:
- ✅ **Autonomous AI Execution**:
  - ProactiveAgent ejecuta acciones directamente (reminders, meetings)
  - Sin confirmación manual - "Ya lo guardé" vs "Puedes agregarlo"
  - Respuestas confirman acciones completadas
- ✅ **Intelligent Follow-ups**:
  - Context-aware usando conversation history
  - Detecta actividad del usuario (< 30 min)
  - ProactiveAgent genera mensajes naturales
  - Scheduled a 9am y 6pm (optimizado)
- ✅ **Error Recovery System**:
  - Retry logic con exponential backoff
  - Duplicate detection (PostgreSQL constraint + code)
  - Transient error classification
  - Enhanced logging con error metadata
- ✅ **Testing**: 225 tests passing (+13 nuevos para persist failures)
- ✅ **Documentation**: 2 research guides (2,337 líneas)

**Logros Previos (2025-10-05 - Claude SDK Migration)** ⚡:
- ✅ **Multi-Provider AI System** - 76% cost reduction:
  - Claude Sonnet 4.5: Chat principal ($3/$15 vs $15/$60)
  - Groq Whisper: Transcripción ($0.05/hr vs $0.36/hr)
  - Tesseract: OCR gratuito (vs $0.002/image)
  - OpenAI: Fallback
- ✅ **Specialized AI Agents**:
  - ProactiveAgent: Asistente conversacional con contexto
  - SchedulingAgent: Gestión autónoma de citas
  - FinanceAgent: Control proactivo de gastos
- ✅ **Dependencies**: @anthropic-ai/sdk (Edge-compatible), groq-sdk, tesseract.js, MCP
- ✅ **Cost Tracking**: Budget management ($10/día límite)
- ✅ **Webhook V2**: Integración completa multi-provider

**Otros Logros**:
- ✅ Testing Infrastructure: Jest + Edge Runtime + 225 tests
- ✅ Zod Validation: 13 formatos WhatsApp validados
- ✅ Sistema de IA con GPT-4o implementado
- ✅ Documentación completa Vercel 2025
- ✅ Database optimization (RLS 100x mejora)
- ✅ Edge Functions < 100ms latency