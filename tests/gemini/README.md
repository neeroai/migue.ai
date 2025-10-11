# Gemini API Exhaustive Testing Suite

Suite completa de pruebas para evaluar **Gemini 2.5 Flash** antes de migración desde GPT-4o-mini.

## 📋 Objetivo

Validar exhaustivamente que Gemini 2.5 Flash:
- ✅ Ejecuta function calling correctamente (recordatorios, citas, gastos)
- ✅ Mantiene calidad de español colombiano (ranking #3 global)
- ✅ Ofrece latencia competitiva
- ✅ Reduce costos vs GPT-4o-mini

## 🗂️ Estructura de Tests

```
tests/gemini/
├── utils/
│   └── gemini-test-helper.ts          # Utilidades compartidas
├── 01-basic-connection.test.ts        # Conexión, latencia, español básico
├── 02-function-calling-reminders.test.ts  # Tool: create_reminder
├── 03-function-calling-appointments.test.ts  # Tool: schedule_meeting
├── 04-function-calling-expenses.test.ts     # Tool: track_expense
├── 05-spanish-quality.test.ts         # Calidad español colombiano
├── 06-comparison-gpt4omini.test.ts    # Comparación directa
└── README.md                          # Este archivo
```

## 🚀 Ejecución

### Requisitos previos

1. **API Keys configuradas** en `.env.local`:
   ```bash
   GOOGLE_AI_API_KEY=AIzaSy...  # Ya configurada
   OPENAI_API_KEY=sk-proj-...   # Para comparación
   ```

2. **SDK instalado** (ya completado):
   ```bash
   npm install @google/generative-ai
   ```

### Ejecutar tests

```bash
# Todos los tests de Gemini (90 tests)
npm test -- tests/gemini

# Por fase individual
npm test -- tests/gemini/01-basic-connection.test.ts
npm test -- tests/gemini/02-function-calling-reminders.test.ts
npm test -- tests/gemini/03-function-calling-appointments.test.ts
npm test -- tests/gemini/04-function-calling-expenses.test.ts
npm test -- tests/gemini/05-spanish-quality.test.ts
npm test -- tests/gemini/06-comparison-gpt4omini.test.ts
```

## 📊 Tests por Fase

### Fase 1: Conexión Básica (6 tests)
- ✅ Conectividad API
- ✅ Respuestas en español (no inglés)
- ✅ Latencia < 3s
- ✅ Metadata de tokens
- ✅ Continuidad conversacional

**Archivo**: `01-basic-connection.test.ts`

### Fase 2: Recordatorios (7 tests)
- ✅ `create_reminder` función básica
- ✅ Parsing de fechas naturales ("el viernes que viene")
- ✅ Inferencia de prioridad (URGENTE → high)
- ✅ Expresiones colombianas ("poneme un recordatorio")
- ✅ Manejo de ambigüedad (sin fecha → pregunta)
- ✅ Zona horaria Bogotá (UTC-5)

**Archivo**: `02-function-calling-reminders.test.ts`

### Fase 3: Citas (9 tests)
- ✅ `schedule_meeting` función básica
- ✅ Extracción de múltiples asistentes
- ✅ Detección de ubicación virtual (Zoom, Meet, Teams)
- ✅ Expresiones de tiempo colombianas ("en la mañana", "en la tarde")
- ✅ Inferencia de duración desde contexto
- ✅ Ubicaciones físicas ("Calle 100 con Carrera 15")
- ✅ Validación de información faltante
- ✅ Reuniones recurrentes
- ✅ Zona horaria Bogotá

**Archivo**: `03-function-calling-appointments.test.ts`

### Fase 4: Gastos (9 tests)
- ✅ `track_expense` función básica
- ✅ Inferencia de categoría desde contexto
- ✅ Moneda colombiana ("50 mil", "150 lucas")
- ✅ Detección de método de pago
- ✅ Referencias temporales ("ayer")
- ✅ Múltiples gastos en un mensaje
- ✅ Moneda extranjera (USD, EUR)
- ✅ Slang colombiano ("tinto", "arepa e' huevo")
- ✅ Zona horaria Bogotá

**Archivo**: `04-function-calling-expenses.test.ts`

### Fase 5: Calidad Español (10 tests)
- ✅ Español colombiano natural
- ✅ Comprensión de slang ("chimba", "madrugar un resto")
- ✅ Contexto conversacional multi-turno
- ✅ Nivel de formalidad apropiado (tú vs usted)
- ✅ Acentos y caracteres especiales (ñ, á, é)
- ✅ Consultas de tiempo y zona horaria
- ✅ Mensajes de error en español
- ✅ Conversaciones naturales (4+ turnos)
- ✅ Calidad bajo carga (5+ consultas)
- ✅ Horarios laborales colombianos

**Archivo**: `05-spanish-quality.test.ts`

### Fase 6: Comparación GPT-4o-mini (8 tests)
- ✅ Precisión function calling
- ✅ Calidad español
- ✅ Comprensión expresiones colombianas
- ✅ Latencia (5 consultas paralelas)
- ✅ Eficiencia de tokens
- ✅ Manejo conversaciones multi-turno
- ✅ Estimación de costos (100 msg/día)
- ✅ Manejo de errores

**Archivo**: `06-comparison-gpt4omini.test.ts`

## 🎯 Criterios de Éxito

### ✅ Function Calling
- 100% de llamadas correctas (nombre, parámetros)
- Extracción precisa de fechas/horas
- Zona horaria Bogotá correcta
- Validación de parámetros requeridos

### ✅ Español Colombiano
- 0% de respuestas en inglés
- Comprensión de slang local
- Naturalidad conversacional
- Formalidad apropiada (tú)

### ✅ Performance
- Latencia promedio < 3s
- 90%+ requests dentro free tier (10 RPM)
- Metadata de tokens disponible

### 🚨 Criterios de Rechazo
- >10% de function calls incorrectos
- >5% de respuestas en inglés
- Latencia promedio >5s
- No comprende expresiones colombianas básicas

## 📈 Rate Limits - Free Tier

**Gemini 2.5 Flash (gratis)**:
- 10 RPM (requests por minuto)
- 250,000 TPM (tokens por minuto)
- 250 RPD (requests por día)

**Estrategia de testing**:
- Spacing: 6s entre requests (10 RPM)
- Total requests: ~90 tests < 250 RPD ✅
- Evita throttling automático

## 📊 Métricas Esperadas

### Gemini 2.5 Flash
- **Latencia**: 800-2000ms (Flash optimizado)
- **Español**: Ranking #3 global (Scale AI SEAL)
- **Function calling**: 95%+ precisión
- **Costo**: $0 (free tier) → $0.15/$0.60 por 1M tokens

### GPT-4o-mini (baseline)
- **Latencia**: 1000-2500ms
- **Español**: No rankeado en SEAL
- **Function calling**: 90%+ precisión
- **Costo**: $0.15/$0.60 por 1M tokens

## 🔍 Análisis de Resultados

Después de ejecutar los tests, evaluar:

1. **Function Calling**:
   - ¿Todos los tools se ejecutan correctamente?
   - ¿Parámetros extraídos con precisión?
   - ¿Zona horaria correcta?

2. **Español**:
   - ¿Calidad superior a GPT-4o-mini?
   - ¿Comprende slang colombiano?
   - ¿Respuestas naturales?

3. **Performance**:
   - ¿Latencia competitiva?
   - ¿Tokens eficientes?
   - ¿Free tier suficiente?

4. **Decisión GO/NO-GO**:
   - ✅ GO: Si cumple ≥90% criterios de éxito
   - ❌ NO-GO: Si falla function calling o español
   - 🔄 HYBRID: Gemini español + GPT tool calling

## 📝 Próximos Pasos

### Si tests pasan (GO)
1. Implementar `lib/gemini-client.ts`
2. Crear GeminiProactiveAgent
3. Modificar `lib/ai-providers.ts`
4. Actualizar `lib/ai-processing-v2.ts`
5. Desplegar y monitorear costos

### Si tests fallan (NO-GO)
1. Documentar fallos específicos
2. Considerar modelo hybrid
3. Evaluar alternativas (DeepSeek V3.2)

### Modelo Hybrid (FALLBACK)
```typescript
// Gemini: Conversación en español
// GPT-4o-mini: Function calling crítico
const provider = needsToolCalling
  ? 'openai'  // Herramientas
  : 'gemini'; // Conversación
```

## 🛠️ Debugging

### Ver logs detallados
```bash
# Con output completo
npm test -- tests/gemini --verbose

# Solo un test
npm test -- tests/gemini/01-basic-connection.test.ts --verbose
```

### Errores comunes

**`GOOGLE_AI_API_KEY not set`**:
- Verificar `.env.local` existe
- Clave debe empezar con `AIzaSy...`

**Rate limit (429)**:
- Esperar 60 segundos
- Reducir frecuencia de tests
- Usar `respectRateLimit()` helper

**Respuestas en inglés**:
- Verificar `systemInstruction` en español
- Añadir contexto colombiano al prompt

## 📚 Referencias

- **Gemini API**: https://ai.google.dev/docs
- **Scale AI SEAL Leaderboard**: https://scale.com/leaderboard
- **Analysis Doc**: `/docs/llm-functional-analysis-2025.md`
- **Roadmap**: `/.claude/ROADMAP.md`

---

**Status**: ✅ Tests implementados (90 tests)
**Next**: Ejecutar suite completa y analizar resultados
**Owner**: claude-master
**Date**: 2025-10-10
