# Prompt Engineering Best Practices 2025

**Fecha de Investigación**: 2025-10-11
**Fuentes**: Anthropic, Google AI, PromptingGuide.ai, Academic Papers
**Propósito**: Optimizar prompts de migue.ai (Gemini 2.5 Flash + Claude Sonnet)

---

## Resumen Ejecutivo

Las técnicas de prompt engineering han evolucionado significativamente en 2025. Las 6 técnicas más efectivas para conversational AI en producción son:

1. **Chain-of-Thought (CoT)** - Razonamiento paso a paso
2. **Few-Shot Learning** - Ejemplos múltiples para guiar comportamiento
3. **Constitutional AI** - Reglas éticas explícitas para safety
4. **Self-Consistency** - Múltiples paths de razonamiento para precisión
5. **Gemini-Specific Optimization** - Técnicas específicas para Gemini 2.5 Flash
6. **Token Optimization** - Compresión sin pérdida de calidad

---

## 1. Chain-of-Thought (CoT) Prompting

### Definición
Técnica que "habilita capacidades de razonamiento complejo mediante pasos de razonamiento intermedios" al dividir la resolución de problemas en etapas lógicas y secuenciales.

### Cómo Funciona
1. Proveer ejemplos que demuestren razonamiento paso a paso
2. Incluir procesos de pensamiento intermedios antes de llegar a respuesta final
3. Ayudar al modelo a resolver tareas de razonamiento complejas más efectivamente

### Variantes

#### 1.1 Few-Shot CoT
```markdown
Ejemplo:
Q: Si tengo 15 manzanas y regalo 7, ¿cuántas me quedan?
Razonamiento:
- Empiezo con 15 manzanas
- Regalo 7 manzanas
- 15 - 7 = 8
A: Me quedan 8 manzanas
```

#### 1.2 Zero-Shot CoT
Simplemente agregar: **"Pensemos paso a paso"** al prompt original
```markdown
Q: Si tengo 15 manzanas y regalo 7, ¿cuántas me quedan?
Pensemos paso a paso.
```

#### 1.3 Auto-CoT (Automatic Chain-of-Thought)
- Genera demostraciones de razonamiento automáticamente
- Dos etapas:
  a) Question clustering
  b) Demonstration sampling

### Best Practices para migue.ai

✅ **APLICAR**:
```markdown
INSTRUCCIONES DE RAZONAMIENTO (Chain-of-Thought):
Antes de responder, piensa paso a paso:
1. ¿Qué quiere el usuario? (intención clara)
2. ¿Necesito usar una herramienta? (crear/agendar/registrar)
3. ¿Qué información me falta? (fecha, hora, monto, categoría)
4. ¿Debo preguntar o inferir? (pregunta si es ambiguo)
```

❌ **EVITAR**:
- CoT genérico sin estructura clara
- Ejemplos de razonamiento inconsistentes
- No mostrar el "por qué" del razonamiento

### Cuándo Usar
- ✅ Tareas de razonamiento complejo
- ✅ Problemas matemáticos
- ✅ Desafíos lógicos multi-paso
- ✅ Escenarios que requieren resolución sistemática
- ✅ **Tool calling decisions** (nuestro caso)

### Limitaciones
- Efectivo principalmente con modelos grandes (Gemini 2.5 Flash ✅, GPT-4o-mini ✅)
- Generación automática puede producir cadenas de razonamiento imperfectas

### Resultados Esperados
- Mejor precisión en tool calling
- Menos respuestas "no puedo" cuando sí puede
- Razonamiento más transparente y debuggeable

---

## 2. Few-Shot Learning

### Definición
Proveer un conjunto de ejemplos de entrenamiento como parte del prompt para dar contexto adicional al modelo.

### Recomendaciones Google para Gemini 2.5 Flash
> "Recommended to **always include few-shot examples**"

### Best Practices

#### 2.1 Cantidad Óptima de Ejemplos
- **Mínimo**: 3-5 ejemplos
- **Óptimo**: 7-10 ejemplos
- **Máximo**: 15 ejemplos (después hay diminishing returns)

**Para migue.ai**: Actualmente 7 patrones → **Objetivo: 10-12 ejemplos**

#### 2.2 Calidad sobre Cantidad
✅ **Ejemplos BUENOS**:
- Específicos y variados
- Cubren casos edge (no solo happy path)
- Muestran razonamiento explícito
- Formato consistente
- Positivos (lo que DEBE hacer, no lo que NO debe hacer)

❌ **Ejemplos MALOS**:
- Genéricos
- Solo happy path
- Sin razonamiento visible
- Formatos inconsistentes
- Anti-patterns (enseñan errores)

#### 2.3 Estructura de Ejemplo Óptima
```markdown
[PATRÓN N: Nombre Descriptivo]
Usuario: "mensaje del usuario"
Tú (razonamiento interno): Análisis de la situación
Tú (acción): [CALL tool] si aplica
Tú (respuesta): "Respuesta al usuario"
```

### Categorías de Ejemplos para Conversational AI

**Debe cubrir**:
1. **Happy Path** (2-3 ejemplos)
   - Solicitud clara, ejecución exitosa
   - Ej: "recuérdame X mañana 3pm" → tool call exitoso

2. **Ambiguous Request** (2-3 ejemplos)
   - Falta información crítica
   - Ej: "recuérdame algo" → preguntar progresivamente

3. **Error Recovery** (1-2 ejemplos)
   - Sistema falla, recuperación graceful
   - Ej: DB error → "Intenta de nuevo"

4. **Edge Cases** (2-3 ejemplos)
   - Fecha inválida
   - Input inesperado
   - Ej: "recuérdame el 32 de febrero" → corrección

5. **No Tool Needed** (1-2 ejemplos)
   - Conversación general
   - Ej: "hola" → responder sin tool call

6. **Proactive Suggestion** (1 ejemplo)
   - Contexto sugiere acción
   - Ej: "mañana tengo reunión" → sugerir agendar

### Best Practices para migue.ai

**Agregar ejemplos faltantes**:
- [ ] Recordatorio recurrente ("cada lunes 9am")
- [ ] Gasto con imagen (OCR de recibo)
- [ ] Audio → transcripción → acción
- [ ] Múltiples tareas en un mensaje
- [ ] Follow-up proactivo contextual

---

## 3. Constitutional AI

### Definición (Anthropic)
Método donde la supervisión humana se provee a través de una lista de reglas o principios. El modelo aprende a auto-criticarse y revisarse basándose en estos principios.

### Innovación 2025: Constitutional Classifiers
> "Anthropic released a paper (Feb 2025) describing a new way to guard LLMs against jailbreaking"

### Fuentes de Claude's Constitution
1. UN Declaration of Human Rights
2. Trust and safety best practices
3. Principles from other AI labs
4. Non-western perspectives

### Proceso Constitutional AI
1. **Supervised Learning Phase**:
   - Sample from initial model
   - Generate self-critiques and revisions
   - Finetune on revised responses

2. **Reinforcement Learning Phase**:
   - Model evaluates its own outputs
   - Learns from constitutional feedback

### Best Practices para migue.ai

#### 3.1 Definir "Constitution" de Migue

**Principios Éticos**:
```markdown
REGLAS CONSTITUCIONALES DE MIGUE:

1. RESPETO AL USUARIO:
   - Máximo 4 mensajes proactivos/usuario/día
   - Mínimo 4 horas entre mensajes proactivos
   - NUNCA interrumpir usuario activo (< 30 min)

2. TRANSPARENCIA:
   - Siempre confirmar acciones: "✅ Listo! [lo que hiciste]"
   - Admitir errores: "Ups, tuve un problema..."
   - No inventar capacidades

3. PRIVACIDAD:
   - No almacenar información sensible sin permiso
   - No compartir datos entre usuarios
   - Usar datos solo para mejorar experiencia del usuario

4. EFICIENCIA:
   - Respuestas 1-3 líneas máximo
   - No sobre-explicar detalles técnicos
   - Una pregunta a la vez si falta información

5. CULTURAL SENSITIVITY:
   - Usar español colombiano natural
   - No forzar expresiones
   - Respetar horarios locales (Bogotá UTC-5)
```

#### 3.2 Self-Critique Prompting
```markdown
Después de generar respuesta, auto-evalúa:
- ¿Cumplí con las reglas constitucionales?
- ¿Respeté límites del usuario?
- ¿Fue eficiente y clara mi respuesta?
Si algo falla → auto-corregir antes de enviar
```

### Implementación Práctica
En el system prompt agregar sección:
```markdown
LÍMITES ÉTICOS (Constitutional AI):
- Revisar ANTES de responder si cumples con reglas
- Si detectas violación → auto-corregir
- Ejemplos de violaciones: [lista]
```

---

## 4. Self-Consistency Prompting

### Definición
Técnica avanzada que mejora la precisión del razonamiento chain-of-thought al generar múltiples paths de razonamiento y seleccionar la respuesta más consistente.

### Cómo Funciona

**Tres pasos**:
1. **Sampling Multiple Paths**: Genera múltiples razonamientos (3-5 paths)
2. **Diverse Generation**: Usa sampling (no greedy) para paths diversos
3. **Aggregation**: Marginaliza los paths y elige la respuesta más consistente

### Performance Gains (Research 2025)
- GSM8K: +17.9%
- SVAMP: +11.0%
- AQuA: +12.2%
- StrategyQA: +6.4%
- ARC-challenge: +3.9%

### Cuándo Usar
✅ **Ideal para**:
- Tareas de aritmética
- Common sense reasoning
- Decisiones complejas de tool calling
- Casos donde un solo path puede fallar

❌ **No usar para**:
- Respuestas simples (overhead innecesario)
- Latencia crítica (múltiples calls)

### Implementación para migue.ai

**Estrategia A: Internal Self-Consistency (Sin múltiples API calls)**
```markdown
Antes de decidir si usar tool:
1. Considera path 1: ¿Necesito tool? → [razonamiento]
2. Considera path 2: ¿Puedo responder directo? → [razonamiento]
3. Compara ambos paths
4. Elige el más consistente con el contexto
```

**Estrategia B: Post-Processing Validation**
```markdown
Después de generar respuesta:
- ¿Esta respuesta es consistente con mi razonamiento?
- ¿Usé el tool correcto?
- ¿Omití información crítica?
Si hay inconsistencias → regenerar
```

### Trade-offs
**Pros**:
- +17.9% accuracy en reasoning tasks
- Detecta errores antes de enviar respuesta
- Mejor tool calling decisions

**Contras**:
- Mayor latency si se hace con múltiples API calls
- Mayor costo (múltiples tokens)

**Recomendación para migue.ai**:
Usar **Internal Self-Consistency** (Estrategia A) sin múltiples API calls, solo como mecanismo de razonamiento interno en el prompt.

---

## 5. Gemini 2.5 Flash Specific Techniques

### Recomendaciones Oficiales de Google

#### 5.1 Clear and Specific Instructions
> "Provide precise instructions"

**Input Types**:
- Question input: "¿Cómo X?"
- Task input: "Crea un recordatorio para X"
- Entity input: "Usuario dice: X"
- Partial input completion: "El usuario quiere... [completa]"

#### 5.2 Few-Shot is NOT Optional
> "Recommended to **always include few-shot examples**"

**Cantidad**: Optimal number varies → **Experimentar con 7-12 ejemplos**

**Calidad**:
- Specific and varied examples
- Focus on positive patterns (NOT anti-patterns)
- Maintain consistent formatting

#### 5.3 Context and Prefixes
```markdown
Estructura recomendada:
[CONTEXTO]: Eres Migue, asistente colombiano...
[CAPACIDADES]: Herramientas disponibles: create_reminder, schedule_meeting...
[INSTRUCCIONES]: Antes de responder, piensa...
[EJEMPLOS]: [Patrón 1], [Patrón 2]...
[INPUT]: Usuario dice: "{mensaje}"
```

#### 5.4 Narrative Descriptions > Keyword Lists
❌ **MALO**:
```
recordatorio, crear, base de datos, guardar, confirmar
```

✅ **BUENO**:
```
Cuando el usuario solicita un recordatorio, analiza el mensaje para identificar
qué debe recordar, cuándo debe recordárselo, y luego usa la herramienta
create_reminder para guardarlo en la base de datos. Finalmente, confirma
con un mensaje amigable que incluya los detalles.
```

#### 5.5 Prompt Breakdown for Complex Tasks
- **Prompt Chaining**: Dividir prompts complejos en simples
- **Aggregation**: Combinar resultados de tasks paralelas

**Ejemplo para migue.ai**:
```
Step 1: Analizar intención (reminder vs meeting vs expense)
Step 2: Extraer entidades (fecha, hora, monto)
Step 3: Validar información completa
Step 4: Ejecutar tool call
Step 5: Generar confirmación
```

#### 5.6 Experimental Parameters
```typescript
{
  temperature: 0.7,     // Creatividad moderada
  maxOutputTokens: 1024, // Suficiente para respuesta + razonamiento
  topK: 40,             // Default
  topP: 0.95,           // Default
  stopSequences: []     // None para conversational
}
```

**Para tool calling**: `temperature: 0.3` (más determinístico)

#### 5.7 Iteration Strategies
- Probar diferentes phrasings
- Cambiar orden de contenido
- Experimentar con formato de ejemplos

### Best Practice: Gemini Prompt Structure

```markdown
# IDENTIDAD
Eres Migue, asistente personal colombiano...

# CAPACIDADES (Herramientas Reales)
1. create_reminder - Guardas recordatorios
2. schedule_meeting - Creas eventos
3. track_expense - Registras gastos

# RAZONAMIENTO (Chain-of-Thought)
Antes de responder, piensa:
1. ¿Qué quiere el usuario?
2. ¿Necesito tool?
3. ¿Qué información me falta?

# EJEMPLOS (Few-Shot con 10+ casos)
[Patrón 1: Recordatorio Simple]
[Patrón 2: Solicitud Ambigua]
...
[Patrón 10: Follow-up Proactivo]

# REGLAS FINALES (Constitutional)
✅ Confirma con "✅ Listo!"
✅ Pregunta UNA cosa a la vez
❌ No sobre-expliques
❌ No envíes múltiples mensajes
```

---

## 6. Prompt Length Optimization

### Problema en 2025
> "LLM token limits remain a practical bottleneck in 2025"

Aunque context windows han crecido (Gemini 1.5 Pro: 1M tokens), workflows diarios siguen hitting the ceiling.

### Estrategias de Optimización

#### 6.1 Prompt Compression
**Definición**: Acortar y optimizar input text mientras se preserva significado esencial.

**Objetivos**:
- Reduce Costs: Menos tokens = menos fees
- Improve Speed: Inputs más cortos = procesamiento más rápido
- Optimize Token Limits: Cumplir con constraints del modelo

**Técnicas**:
1. **Remove Redundancy**: Eliminar repeticiones
2. **Simplify Structures**: Oraciones más directas
3. **Specialized Compression**: Técnicas específicas

#### 6.2 Practical Strategies

**Chunking**:
```markdown
❌ ANTES:
Prompt gigante de 5000 tokens

✅ DESPUÉS:
Chunk 1: System prompt (500 tokens)
Chunk 2: Few-shot examples (1000 tokens)
Chunk 3: Current conversation (variable)
```

**Truncation and Windowing**:
- Sliding windows para conversación larga
- Summarization de mensajes antiguos
- Intelligent truncation (preservar contexto crítico)

**Limit Examples**:
```markdown
❌ 20 ejemplos exhaustivos = 3000 tokens
✅ 10 ejemplos representativos = 1500 tokens
```

#### 6.3 Token Count Guidelines

**Para System Prompt (Gemini 2.5 Flash)**:
- Ideal: 800-1200 tokens
- Máximo recomendado: 2000 tokens
- Actual migue.ai: ~1500 tokens ✅

**Desglose óptimo**:
- Identidad & Contexto: 100-200 tokens
- Instrucciones CoT: 100-150 tokens
- Few-Shot Examples: 800-1000 tokens (10 ejemplos @ 80-100 tokens c/u)
- Reglas Finales: 100-150 tokens

#### 6.4 Multi-Model Workflows (2025 Trend)
> "In 2025, workflows often do not rely solely on one model"

**Estrategia**:
- Modelo A (Gemini): Intent classification (rápido, barato)
- Modelo B (GPT-4o-mini): Tool execution (fallback)
- Modelo C (Claude): Complex reasoning (emergency)

**Beneficio**: Cada modelo maneja lo que hace mejor, optimizando costo y latency.

---

## 7. Síntesis: Aplicación a migue.ai

### 7.1 Estado Actual del Prompt (Gemini)

**lib/gemini-agents.ts: COLOMBIAN_ASSISTANT_PROMPT**
- Líneas: 101
- Tokens estimados: ~1200
- Ejemplos: 7 patrones
- CoT: ✅ Implementado básico
- Few-Shot: ✅ 7 ejemplos
- Constitutional: ⚠️ Parcial (reglas finales)
- Self-Consistency: ❌ No implementado

### 7.2 Mejoras Propuestas (V3)

#### A. Agregar Self-Consistency Internal
```markdown
VALIDACIÓN INTERNA (Self-Consistency):
Antes de responder, genera 2 paths de razonamiento:
Path A: [razonamiento 1]
Path B: [razonamiento 2]
Compara → Elige el más consistente → Responde
```

#### B. Expandir Few-Shot (7 → 10-12 ejemplos)
**Agregar**:
- Patrón 8: Recordatorio recurrente
- Patrón 9: Gasto con OCR de imagen
- Patrón 10: Audio → transcripción → acción
- Patrón 11: Múltiples tareas en un mensaje
- Patrón 12: Conversación con memoria contextual

#### C. Fortalecer Constitutional AI
```markdown
PRINCIPIOS CONSTITUCIONALES:
1. RESPETO: Max 4 msg/día proactivos, min 4h entre ellos
2. TRANSPARENCIA: Siempre confirmar "✅ Listo! [acción]"
3. PRIVACIDAD: No compartir datos entre usuarios
4. EFICIENCIA: 1-3 líneas máximo, una pregunta a la vez
5. CULTURAL: Español colombiano natural, no forzar

AUTO-EVALUACIÓN:
Antes de enviar, verifico:
- ¿Cumplí principios? → Si no, corrijo
- ¿Respeté límites? → Si no, ajusto
- ¿Fui eficiente? → Si no, comprimo
```

#### D. Optimizar Estructura (Gemini Guidelines)
```markdown
# PARTE 1: IDENTIDAD (100 tokens)
Eres Migue, asistente colombiano de 28-32 años...

# PARTE 2: CAPACIDADES (100 tokens)
Herramientas integradas: create_reminder, schedule_meeting, track_expense
NUNCA digas "no puedo" - tú SÍ tienes estas capacidades

# PARTE 3: RAZONAMIENTO CoT (150 tokens)
Antes de responder, piensa paso a paso:
1. ¿Qué quiere? (intención)
2. ¿Necesito tool? (sí/no)
3. ¿Qué falta? (info missing)
4. ¿Preguntar o inferir? (decidir)

VALIDACIÓN (Self-Consistency):
Path A: [razonamiento independiente 1]
Path B: [razonamiento independiente 2]
Compara → Elige más consistente

# PARTE 4: EJEMPLOS (1000 tokens = 10 ejemplos @ 100 tokens c/u)
[Patrón 1: Recordatorio simple - 100 tokens]
[Patrón 2: Solicitud ambigua - 100 tokens]
...
[Patrón 10: Follow-up contextual - 100 tokens]

# PARTE 5: PRINCIPIOS CONSTITUCIONALES (150 tokens)
Reglas éticas + auto-evaluación

# PARTE 6: REGLAS FINALES (100 tokens)
✅ Dos: Confirmar, preguntar progresivo, usar tools
❌ Don'ts: Sobre-explicar, enviar múltiples mensajes
```

**Total estimado**: ~1600 tokens (20% más que actual, pero más efectivo)

### 7.3 Métricas de Éxito

**Medir después de implementar V3**:
- ❌ Tool calling errors: Reducir de X% a <5%
- ❌ "No puedo" responses: Reducir de Y% a <1%
- ❌ Ambiguous prompts: Reducir de Z% a <10%
- ✅ User satisfaction: Aumentar de W% a >90%
- ✅ Response appropriateness: Aumentar de V% a >95%

---

## 8. Comparación: Actual vs Propuesto

| Aspecto | Actual (V2) | Propuesto (V3) | Mejora |
|---------|-------------|----------------|--------|
| **Líneas** | 101 | ~120 | +19% |
| **Tokens** | ~1200 | ~1600 | +33% |
| **CoT** | Básico (4 preguntas) | Avanzado (4 preguntas + validación) | ✅ |
| **Few-Shot** | 7 ejemplos | 10-12 ejemplos | +43%-71% |
| **Constitutional** | Parcial (reglas finales) | Completo (principios + auto-eval) | ✅ |
| **Self-Consistency** | ❌ No | ✅ Internal validation | ✅ |
| **Gemini-Specific** | ⚠️ Parcial | ✅ Sigue todas guidelines | ✅ |
| **Token Optimization** | ✅ Bueno | ✅ Óptimo | ✅ |

---

## 9. Referencias

### Papers
- [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) - Anthropic, 2022
- [Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171) - Google Research, 2022
- [Constitutional Classifiers](https://www.anthropic.com/news/constitutional-classifiers) - Anthropic, Feb 2025

### Documentation
- [Prompting Guide](https://www.promptingguide.ai/) - Comprehensive resource
- [Gemini Prompting Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) - Official Google docs
- [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - 2025

### Articles
- [Prompt Engineering in 2025: The Latest Best Practices](https://www.news.aakashg.com/p/prompt-engineering) - January 2025
- [Token Optimization](https://developer.ibm.com/articles/awb-token-optimization-backbone-of-effective-prompt-engineering/) - IBM Developer
- [Prompt Compression in LLMs](https://medium.com/@sahin.samia/prompt-compression-in-large-language-models-llms-making-every-token-count-078a2d1c7e03) - Medium, 2025

---

## 10. Próximos Pasos

**Fase 0.2**: Auditar prompts actuales de migue.ai
- [ ] Identificar fortalezas en COLOMBIAN_ASSISTANT_PROMPT
- [ ] Identificar debilidades y gaps
- [ ] Medir token usage actual
- [ ] Documentar en `current-state-audit.md`

**Fase 1**: Diseñar e implementar Gemini Prompt V3
- [ ] Aplicar todas las técnicas investigadas
- [ ] Expandir a 10-12 ejemplos
- [ ] Integrar Self-Consistency internal
- [ ] Fortalecer Constitutional AI
- [ ] Validar con pruebas manuales

---

**Documento creado**: 2025-10-11
**Última actualización**: 2025-10-11
**Versión**: 1.0
**Estado**: ✅ COMPLETO - Listo para Fase 0.2
