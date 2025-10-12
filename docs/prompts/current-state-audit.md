# Auditoría de Prompts Actuales - migue.ai

**Fecha**: 2025-10-11
**Archivos Auditados**:
- `lib/gemini-agents.ts` (445 líneas)
- `lib/claude-agents.ts` (552 líneas)

**Metodología**: Comparación vs mejores prácticas 2025 (ver `research-2025.md`)

---

## 1. Prompt de Gemini (COLOMBIAN_ASSISTANT_PROMPT)

**Ubicación**: `lib/gemini-agents.ts` líneas 17-101
**Longitud**: 85 líneas de código (estimado ~1200 tokens)
**Versión actual**: V2

### 1.1 Análisis Estructural

```markdown
ESTRUCTURA ACTUAL:
├── IDENTIDAD Y CONTEXTO (4 líneas)
├── TUS CAPACIDADES REALES (3 items)
├── INSTRUCCIONES DE RAZONAMIENTO (4 pasos CoT)
├── PATRONES DE CONVERSACIÓN (7 ejemplos)
│   ├── Patrón 1: Recordatorio Simple
│   ├── Patrón 2: Solicitud Ambigua
│   ├── Patrón 3: Recuperación de Error
│   ├── Patrón 4: Sugerencia Proactiva
│   ├── Patrón 5: Registro de Gasto
│   ├── Patrón 6: Nota de Voz + Acción
│   └── Patrón 7: Conversación General
└── REGLAS FINALES (6 reglas)
```

### 1.2 Fortalezas ✅

1. **Chain-of-Thought Implementado**
   ```markdown
   Antes de responder, piensa paso a paso:
   1. ¿Qué quiere el usuario? (intención clara)
   2. ¿Necesito usar una herramienta? (crear/agendar/registrar)
   3. ¿Qué información me falta? (fecha, hora, monto, categoría)
   4. ¿Debo preguntar o inferir? (pregunta si es ambiguo)
   ```
   ✅ **Cumple**: CoT básico implementado correctamente

2. **Few-Shot Examples (7 patrones)**
   - Cobertura razonable de casos principales
   - Formato consistente en todos los ejemplos
   - Incluye razonamiento explícito: `Tú (razonamiento): ...`

3. **Identidad Clara**
   - Ubicación: Bogotá, Colombia (UTC-5)
   - Personalidad: ENFJ definida
   - Tono: Eficientemente amigable
   - Expresiones colombianas: "tinto", "lucas", "parce", "de una"

4. **Anti-Negation Strong**
   ```markdown
   NUNCA DIGAS: "no puedo", "no tengo acceso", "no tengo capacidad"
   → Tú SÍ tienes estas capacidades mediante herramientas.
   ```
   ✅ **Excelente**: Ataca directamente el problema de falsos "no puedo"

5. **Tool Calling Explícito**
   - Ejemplos muestran `[CALL create_reminder]`
   - Clarifica cuándo usar vs no usar tools

6. **Progressive Disclosure**
   ```markdown
   ✅ Pregunta UNA cosa a la vez si falta info
   ```
   ✅ **Cumple**: Principio de UX implementado

### 1.3 Debilidades ❌

1. **Falta Self-Consistency**
   - NO hay validación interna de razonamiento
   - NO compara múltiples paths antes de responder
   - **Gap vs Best Practice**: Self-Consistency puede mejorar accuracy +17.9%

2. **Constitutional AI Incompleto**
   - Reglas finales existen pero NO hay auto-evaluación
   - NO hay mecanismo de "revisar antes de enviar"
   - **Gap vs Best Practice**: Falta step de self-critique

3. **Few-Shot Limitado (7 ejemplos)**
   - Recomendación Google: "always include few-shot" 10-12 óptimo
   - **Casos faltantes**:
     - ❌ Recordatorio recurrente ("cada lunes 9am")
     - ❌ Gasto con imagen/OCR
     - ❌ Múltiples tareas en un mensaje
     - ❌ Follow-up proactivo con contexto histórico
     - ❌ Usuario cambia de tema mid-conversation
     - ❌ Cancelación de recordatorio
   - **Gap**: 7/12 ejemplos (58% coverage)

4. **Longitud No Optimizada**
   - 85 líneas, ~1200 tokens
   - Podría ser más conciso sin perder efectividad
   - **Gap vs Best Practice**: Algunos ejemplos son verbosos

5. **Formato Inconsistente en Ejemplos**
   ```markdown
   [PATRÓN 1: Recordatorio Simple]
   Usuario: "recuérdame llamar a mi mamá mañana"
   Tú (razonamiento): Necesita recordatorio. Falta hora. Pregunto.
   Tú: "Listo! ¿A qué hora te recuerdo?"
   ...
   ```
   - NO todos los patrones incluyen el paso siguiente
   - Algunos cortan la conversación mid-flow
   - **Gap**: Ejemplos no muestran ciclo completo

6. **Falta Contexto de Horario Laboral**
   - Menciona "América/Bogota UTC-5" pero NO reglas de timing
   - NO dice "no enviar mensajes proactivos 11pm-7am"
   - **Gap**: Constitutional AI incompleto

### 1.4 Métricas vs Best Practices 2025

| Aspecto | Actual | Óptimo 2025 | Gap |
|---------|--------|-------------|-----|
| **CoT** | ✅ Básico (4 pasos) | ✅ Avanzado (4 pasos + validación) | ⚠️ Falta validación |
| **Few-Shot** | 7 ejemplos | 10-12 ejemplos | ❌ 58% coverage |
| **Constitutional** | ⚠️ Reglas sin auto-eval | ✅ Reglas + self-critique | ❌ Sin self-critique |
| **Self-Consistency** | ❌ No implementado | ✅ Internal validation | ❌ Missing |
| **Token Count** | ~1200 tokens | 800-1600 tokens | ✅ Dentro rango |
| **Gemini-Specific** | ⚠️ Parcial | ✅ Sigue guidelines | ⚠️ Podría mejorar |

**Score General**: 65/100

### 1.5 Casos de Uso NO Cubiertos

**Escenarios críticos faltantes**:
1. Usuario dice: "recuérdame cada martes 9am comprar mercado"
   - Prompt NO tiene ejemplo de recordatorio recurrente
   - Tool `create_reminder` ¿soporta recurrence?

2. Usuario envía: [imagen de recibo]
   - NO hay ejemplo de flujo completo imagen → OCR → track_expense
   - ¿Cómo debe comportarse?

3. Usuario dice: "cancela mi recordatorio de las 3pm"
   - NO hay ejemplo de cancelación
   - ¿Existe tool para esto?

4. Usuario dice: "recuérdame X y también agenda reunión Y"
   - Múltiples tareas en un mensaje
   - ¿Debe procesar ambas o preguntar una a la vez?

5. Usuario activo hace 15 minutos, Migue envía follow-up proactivo
   - NO hay ejemplo de contexto temporal
   - ¿Cómo usar historial de conversación?

### 1.6 Recomendaciones Específicas

**Cambios Críticos (High Priority)**:
1. Agregar Self-Consistency validation step:
   ```markdown
   VALIDACIÓN INTERNA:
   Antes de responder, genera 2 razonamientos:
   Path A: [análisis independiente 1]
   Path B: [análisis independiente 2]
   Compara → Si consistentes → Responde
   Si contradictorios → Re-analiza con path C
   ```

2. Expandir Few-Shot a 10-12 ejemplos:
   - Patrón 8: Recordatorio recurrente
   - Patrón 9: Imagen de recibo → OCR → track_expense
   - Patrón 10: Audio → transcribe → ejecuta acción
   - Patrón 11: Cancelar recordatorio existente
   - Patrón 12: Múltiples tareas en un mensaje

3. Fortalecer Constitutional AI:
   ```markdown
   AUTO-EVALUACIÓN ANTES DE ENVIAR:
   Verifico que cumplí:
   ✓ Respeto límites del usuario (horarios, frecuencia)
   ✓ Confirmé acciones con "✅ Listo!"
   ✓ Fui eficiente (1-3 líneas)
   ✓ Pregunté solo una cosa
   Si alguno falla → Corrijo antes de enviar
   ```

**Cambios Menores (Medium Priority)**:
4. Optimizar longitud de ejemplos (más concisos)
5. Agregar timing constraints explícitos
6. Mejorar formato de ejemplos (ciclo completo)

---

## 2. Prompt de Claude (ProactiveAgent)

**Ubicación**: `lib/claude-agents.ts` líneas 42-107
**Longitud**: 66 líneas de código (estimado ~900 tokens)
**Versión actual**: V2

### 2.1 Análisis Estructural

```markdown
ESTRUCTURA ACTUAL:
├── IDENTIDAD (1 línea)
├── TUS CAPACIDADES (Herramientas Disponibles)
├── INSTRUCCIONES DE USO DE HERRAMIENTAS
├── PATRONES DE CONVERSACIÓN (6 ejemplos)
│   ├── Recordatorio Simple
│   ├── Solicitud Ambigua
│   ├── Error Recovery
│   ├── Sugerencia Proactiva
│   ├── Registro de Gasto
│   └── Sin Herramienta
└── REGLAS FINALES (6 reglas)
```

### 2.2 Fortalezas ✅

1. **Concisión**
   - 66 líneas vs 85 de Gemini
   - ~900 tokens vs ~1200
   - ✅ **Más eficiente** sin sacrificar calidad

2. **Explícito en Tool Calling**
   ```markdown
   INSTRUCCIONES DE USO DE HERRAMIENTAS:
   1. Detecta intención del usuario
   2. SI necesita tool → LLÁMALO INMEDIATAMENTE (no pidas permiso)
   3. Confirma: "✅ Listo! [lo que hiciste]"
   ```
   ✅ **Excelente**: 3 pasos claros y directos

3. **Anti-Negation Strong**
   ```markdown
   NUNCA digas: "no puedo", "no tengo acceso", "no tengo capacidad"
   → Tú SÍ tienes estas capacidades mediante tools.
   ```
   ✅ Consistente con Gemini

4. **Ejemplos Concisos**
   - Formato más compacto que Gemini
   - Mismo nivel de claridad
   - Mejor token efficiency

### 2.3 Debilidades ❌

1. **Chain-of-Thought Implícito**
   - NO hay sección explícita "ANTES DE RESPONDER, PIENSA:"
   - Razonamiento existe en ejemplos pero NO como instrucción
   - **Gap vs Gemini**: Gemini tiene 4 pasos CoT explícitos
   - **Gap vs Best Practice**: CoT debe ser explícito para ser efectivo

2. **Few-Shot MUY Limitado (6 ejemplos)**
   - 1 ejemplo menos que Gemini
   - **Gap vs Óptimo**: 6/12 ejemplos (50% coverage)
   - Falta mismos casos que Gemini + 1 más

3. **NO Self-Consistency**
   - Igual que Gemini: sin validación interna

4. **Constitutional AI Básico**
   - Reglas existen pero NO auto-evaluación
   - Menos detallado que Gemini

5. **Falta Identidad Cultural**
   - NO menciona: Bogotá, Colombia, expresiones colombianas
   - Solo dice "asistente personal colombiano" genérico
   - **Gap vs Gemini**: Gemini tiene identidad más rica

6. **Sin Patrón de Nota de Voz**
   - Gemini tiene "Patrón 6: Nota de Voz + Acción"
   - Claude NO lo tiene
   - **Gap**: Caso de uso importante missing

### 2.4 Métricas vs Best Practices 2025

| Aspecto | Actual | Óptimo 2025 | Gap |
|---------|--------|-------------|-----|
| **CoT** | ⚠️ Implícito | ✅ Explícito (4 pasos) | ❌ Debe explicitarse |
| **Few-Shot** | 6 ejemplos | 10-12 ejemplos | ❌ 50% coverage |
| **Constitutional** | ⚠️ Básico | ✅ Reglas + self-critique | ❌ Sin self-critique |
| **Self-Consistency** | ❌ No implementado | ✅ Internal validation | ❌ Missing |
| **Token Count** | ~900 tokens | 800-1600 tokens | ✅ Óptimo |
| **Cultural Identity** | ⚠️ Genérico | ✅ Rico (Gemini) | ❌ Mejorar |
| **Concisión** | ✅ Excelente | ✅ Óptimo | ✅ Strength |

**Score General**: 60/100

### 2.5 Comparación Directa: Gemini vs Claude

| Aspecto | Gemini | Claude | Ganador |
|---------|--------|--------|---------|
| **CoT Explícito** | ✅ 4 pasos | ❌ Implícito | Gemini |
| **Few-Shot** | 7 ejemplos | 6 ejemplos | Gemini |
| **Identidad Cultural** | ✅ Rica | ⚠️ Genérica | Gemini |
| **Concisión** | 85 líneas | 66 líneas | Claude |
| **Token Efficiency** | ~1200 | ~900 | Claude |
| **Tool Instructions** | ⚠️ En ejemplos | ✅ Explícito | Claude |
| **Overall Quality** | 65/100 | 60/100 | Gemini |

**Conclusión**: Gemini V2 es ligeramente superior, pero Claude es más eficiente en tokens.

### 2.6 Recomendaciones Específicas

**Cambios Críticos (High Priority)**:
1. Hacer CoT explícito:
   ```markdown
   RAZONAMIENTO ANTES DE ACTUAR:
   Paso 1: Analizar intención del usuario
   Paso 2: Determinar si necesito tool
   Paso 3: Identificar información faltante
   Paso 4: Decidir: ¿preguntar o inferir?
   ```

2. Expandir Few-Shot a 10-12 (same as Gemini recommendations)

3. Enriquecer identidad cultural (match Gemini level)

4. Agregar Self-Consistency validation

**Cambios Menores (Medium Priority)**:
5. Agregar patrón de nota de voz
6. Agregar Constitutional self-critique

---

## 3. Agentes Especializados

### 3.1 SchedulingAgent

**Ubicación**: `lib/claude-agents.ts` líneas 322-428
**Propósito**: Extracción de fechas/horas de mensajes

**System Prompt** (líneas 331-358):
```markdown
Eres un agente especializado en DETECTAR y EXTRAER información de citas y recordatorios.

Tu trabajo es SOLO extraer información, NO confirmar ni crear eventos.

[...instrucciones de extracción JSON...]

IMPORTANTE: Si el mensaje NO contiene información clara de fecha/hora,
responde "NO_APPOINTMENT"
```

#### Análisis

**Fortalezas** ✅:
- Propósito muy específico y claro
- Output estructurado (JSON)
- Fail-fast: "NO_APPOINTMENT" si no hay info
- Temperature 0.1 (determinístico para extraction)

**Debilidades** ❌:
- NO Few-Shot examples (0 ejemplos)
  - **Gap vs Best Practice**: "Recommended to always include few-shot"
- NO CoT (pero para extraction quizás no es crítico)
- NO manejo de ambigüedad
  - ¿Qué pasa si dice "mañana" sin hora?
  - ¿Extrae con hora default o devuelve NO_APPOINTMENT?

**Score**: 55/100

**Recomendación**:
Agregar 3-5 ejemplos de extracción:
```markdown
Ejemplo 1: "recuérdame llamar a mi tía el martes 3pm"
→ { title: "Llamar a mi tía", date: "2025-10-14", time: "15:00" }

Ejemplo 2: "agenda reunión con el equipo mañana"
→ { title: "Reunión con el equipo", date: "2025-10-12", time: "09:00" }

Ejemplo 3: "hola cómo estás"
→ "NO_APPOINTMENT"
```

### 3.2 FinanceAgent

**Ubicación**: `lib/claude-agents.ts` líneas 434-537
**Propósito**: Extracción de gastos y categorización

**System Prompt** (líneas 443-468):
```markdown
Eres un agente especializado en control de gastos personal.

Tus funciones:
1. Extraer montos, categorías y descripciones de gastos
2. Categorizar automáticamente (comida, transporte, entretenimiento, etc.)
3. Detectar patrones de gasto
4. Alertar sobre gastos inusuales
5. Sugerir oportunidades de ahorro

Categorías disponibles:
- Alimentación
- Transporte
- Entretenimiento
- Salud
- Servicios
- Compras
- Otros
```

#### Análisis

**Fortalezas** ✅:
- Categorías bien definidas (7 categories)
- Output estructurado (JSON)
- Funciones múltiples (extract, categorize, detect patterns, alert, suggest)
- Temperature 0.1 (determinístico)

**Debilidades** ❌:
- NO Few-Shot examples (0 ejemplos)
  - **Gap Crítico**: Sin ejemplos, ¿cómo sabe categorizar?
- Funciones 3-5 (detectar patrones, alertar, sugerir) NO están implementadas
  - Promete features que NO hace
  - **Gap vs Realidad**: Over-promising
- NO manejo de montos ambiguos
  - "gasté como 50" vs "gasté 50.000"
  - ¿Cómo interpreta "lucas"?

**Score**: 50/100

**Recomendación**:
1. Agregar 5-7 ejemplos de categorización:
```markdown
Ejemplo 1: "gasté 50 lucas en almuerzo"
→ { amount: 50000, category: "Alimentación", description: "almuerzo" }

Ejemplo 2: "pagué 85 mil de Uber"
→ { amount: 85000, category: "Transporte", description: "Uber" }

Ejemplo 3: "compré un libro por $45,000"
→ { amount: 45000, category: "Entretenimiento", description: "libro" }
```

2. Remover funciones 3-5 (no implementadas) o implementarlas

---

## 4. Síntesis de Hallazgos

### 4.1 Problemas Comunes en Todos los Prompts

| Problema | Gemini | Claude | Scheduling | Finance |
|----------|--------|--------|------------|---------|
| **Falta Self-Consistency** | ❌ | ❌ | N/A | N/A |
| **Constitutional AI Incompleto** | ⚠️ | ⚠️ | N/A | N/A |
| **Few-Shot Insuficiente** | 7/12 | 6/12 | 0/5 | 0/7 |
| **CoT No Explícito** | ✅ | ❌ | N/A | N/A |
| **Casos Edge No Cubiertos** | ❌ | ❌ | ❌ | ❌ |

### 4.2 Ranking de Calidad

1. **Gemini ProactiveAgent**: 65/100 ⭐⭐⭐
   - Fortalezas: CoT explícito, identidad cultural rica, anti-negation
   - Debilidades: Few-shot limitado, sin self-consistency

2. **Claude ProactiveAgent**: 60/100 ⭐⭐⭐
   - Fortalezas: Concisión, token efficiency, tool instructions claras
   - Debilidades: CoT implícito, identidad genérica, fewer examples

3. **SchedulingAgent**: 55/100 ⭐⭐
   - Fortalezas: Propósito específico, output estructurado
   - Debilidades: 0 ejemplos, no maneja ambigüedad

4. **FinanceAgent**: 50/100 ⭐⭐
   - Fortalezas: Categorías definidas, structured output
   - Debilidades: 0 ejemplos, over-promising features

### 4.3 Gap Analysis General

**Brecha vs Best Practices 2025**:
- Few-Shot Coverage: **53% average** (vs 100% óptimo)
- CoT Implementation: **50% prompts** (vs 100% óptimo)
- Constitutional AI: **25% complete** (vs 100% óptimo)
- Self-Consistency: **0% implemented** (vs 100% óptimo)

**Overall Project Score**: **58/100**

### 4.4 Prioridades de Mejora

**CRÍTICAS (Must Fix)**:
1. Expandir Few-Shot a 10-12 ejemplos en agentes principales
2. Agregar ejemplos a agentes especializados (5-7 cada uno)
3. Implementar Self-Consistency validation
4. Hacer CoT explícito en Claude prompt

**IMPORTANTES (Should Fix)**:
5. Completar Constitutional AI (auto-evaluación)
6. Agregar casos edge faltantes (recurrente, cancelación, múltiples tareas)
7. Enriquecer identidad cultural en Claude

**OPCIONALES (Nice to Have)**:
8. Optimizar longitud de ejemplos
9. Mejorar formato de ejemplos (ciclo completo)
10. Agregar timing constraints explícitos

---

## 5. Estimación de Token Usage

### 5.1 Estado Actual

| Prompt | Líneas | Tokens (est.) | Eficiencia |
|--------|--------|---------------|------------|
| **Gemini V2** | 85 | ~1200 | ⚠️ Medio |
| **Claude V2** | 66 | ~900 | ✅ Alto |
| **SchedulingAgent** | 28 | ~400 | ✅ Alto |
| **FinanceAgent** | 26 | ~350 | ✅ Alto |

### 5.2 Proyección V3 (Con Mejoras)

| Prompt | V2 Tokens | V3 Tokens (est.) | Cambio |
|--------|-----------|------------------|--------|
| **Gemini V3** | 1200 | 1600 | +33% |
| **Claude V3** | 900 | 1300 | +44% |
| **SchedulingAgent V3** | 400 | 650 | +63% |
| **FinanceAgent V3** | 350 | 700 | +100% |

**Justificación del aumento**:
- Few-Shot: 7 → 12 ejemplos (+500 tokens c/u)
- Self-Consistency: +150 tokens
- Constitutional AI: +100 tokens
- CoT explícito (Claude): +100 tokens

**Trade-off**: +40% tokens → +20-30% accuracy (basado en research)

**Viabilidad**:
- Gemini 2.5 Flash context: 1M tokens ✅
- Todos los prompts < 2K tokens ✅
- Trade-off aceptable ✅

---

## 6. Matriz de Decisión: ¿Qué Actualizar Primero?

### 6.1 Impacto vs Esfuerzo

| Mejora | Impacto | Esfuerzo | Score | Prioridad |
|--------|---------|----------|-------|-----------|
| **Few-Shot +5 ejemplos** | Alto | Medio | 8/10 | 🔴 P1 |
| **Self-Consistency** | Alto | Alto | 7/10 | 🟠 P2 |
| **CoT explícito Claude** | Medio | Bajo | 7/10 | 🟠 P2 |
| **Constitutional complete** | Medio | Medio | 6/10 | 🟡 P3 |
| **Scheduling examples** | Medio | Bajo | 6/10 | 🟡 P3 |
| **Finance examples** | Medio | Bajo | 6/10 | 🟡 P3 |
| **Identity cultural Claude** | Bajo | Bajo | 4/10 | 🟢 P4 |

### 6.2 Roadmap de Implementación

**Sprint 1 (Fase 1.1)**: Few-Shot Expansion
- Gemini: 7 → 12 ejemplos
- Claude: 6 → 12 ejemplos
- Estimado: 1-2 días

**Sprint 2 (Fase 1.2)**: Core Improvements
- Self-Consistency implementation
- CoT explícito en Claude
- Estimado: 1-2 días

**Sprint 3 (Fase 1.3)**: Specialized Agents
- SchedulingAgent: +5 ejemplos
- FinanceAgent: +7 ejemplos
- Constitutional complete
- Estimado: 1 día

---

## 7. Conclusiones

### 7.1 Estado Actual
Los prompts V2 actuales son **funcionales pero no óptimos**. Tienen una base sólida (CoT básico, anti-negation fuerte) pero les falta la profundidad de las mejores prácticas 2025.

**Score Global**: 58/100

### 7.2 Brecha Crítica
La brecha más grande es **Few-Shot insufficiency** (53% coverage). Agregar 3-5 ejemplos por prompt puede mejorar accuracy significativamente sin overhead masivo.

### 7.3 Quick Wins
1. ✅ **Agregar ejemplos a SchedulingAgent y FinanceAgent** (effort bajo, impact medio)
2. ✅ **Hacer CoT explícito en Claude** (effort bajo, impact medio)
3. ✅ **Expandir Few-Shot Gemini 7→10** (effort medio, impact alto)

### 7.4 Long-term Improvements
4. 🔄 **Self-Consistency** (effort alto, impact alto)
5. 🔄 **Constitutional AI complete** (effort medio, impact medio)

---

## 8. Próximos Pasos

**Fase 0.3**: Auditar funcionalidades en código
- [ ] Revisar `lib/reminders.ts`
- [ ] Revisar `lib/scheduling.ts`
- [ ] Revisar `lib/expenses.ts` (si existe)
- [ ] Verificar tool execution en `lib/gemini-agents.ts`
- [ ] Documentar en `functionality-audit.md`

**Fase 0.4**: Verificar Base de Datos
- [ ] Confirmar tabla `reminders` existe
- [ ] Confirmar tabla `expenses` existe (probablemente NO)
- [ ] Confirmar tabla `meetings` existe
- [ ] Documentar en `database-audit.md`

**Fase 1**: Implementar mejoras (después de aprobación)

---

**Documento creado**: 2025-10-11
**Última actualización**: 2025-10-11
**Versión**: 1.0
**Estado**: ✅ COMPLETO - Listo para Fase 0.3
