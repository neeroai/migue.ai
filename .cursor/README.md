# Cursor Rules - Guía de Configuración

Esta carpeta contiene las reglas y configuraciones para el IDE Cursor, incluyendo la documentación sobre cómo convertir subagentes de Claude Code a reglas de Cursor.

## Estructura

```
.cursor/
├── README.md                    # Esta documentación
├── rules/                       # Reglas de comportamiento para Cursor
│   ├── frontend-developer.mdc   # Reglas para desarrollo frontend
│   └── ...                      # Otras reglas específicas
└── docs/                        # Documentación adicional
    ├── conversion-guide.md      # Guía de conversión Claude → Cursor
    └── best-practices.md        # Mejores prácticas para .mdc
```

## ¿Qué son las Cursor Rules?

Las **Cursor Rules** (`.mdc`) son reglas de comportamiento que guían al agente de Cursor en el IDE. A diferencia de los subagentes de Claude Code, estas reglas:

- **No crean agentes nuevos**: Modulan cómo actúa Cursor según contexto
- **Se aplican automáticamente**: Basadas en `globs`, triggers y `applyIntelligently`
- **Son contextuales**: Específicas para el proyecto y archivos que estás editando
- **Integran con el IDE**: Funcionan en chat, code actions, y generación de código

## Diferencias Clave: Claude Subagents vs Cursor Rules

| Aspecto | Claude Subagents (`.claude/agents/`) | Cursor Rules (`.cursor/rules/`) |
|---------|--------------------------------------|--------------------------------|
| **Naturaleza** | Agentes especializados, invocables | Reglas contextuales del IDE |
| **Objetivo** | Delegar tareas con configuración propia | Establecer estándares y políticas |
| **Invocación** | Manual desde Claude Code o con @subagent | Automática por contexto/proyecto |
| **Alcance** | Ventana de contexto separada | Comparte contexto del proyecto |
| **Estructura** | Markdown con capacidades/guías | MDC con front-matter + reglas |
| **Granularidad** | Un agente por rol | Múltiples reglas por tema |
| **Portabilidad** | Vive con Claude Code | Vive en el repo/IDE |

## Formato de Archivos .mdc

Los archivos `.mdc` utilizan un formato específico con:

### Front-matter (Metadatos)
```yaml
---
description: Descripción de la regla
globs: ["**/*.js", "**/*.tsx"]  # Patrones de archivos
applyIntelligently: true         # Aplicación inteligente
priority: high                   # Prioridad de la regla
---
```

### Bloques de Reglas
```markdown
rule: Descripción clara de la regla a seguir
rule: Otra regla específica
```

## Mejores Prácticas

1. **Especificidad**: Reglas claras y directamente aplicables
2. **Modularidad**: Dividir en archivos pequeños por tema
3. **Contexto**: Usar `globs` apropiados para cada regla
4. **Aplicación inteligente**: Preferir `applyIntelligently: true`
5. **Prioridades**: Establecer `priority` según importancia

## Activación de Reglas

### En el IDE
1. Ir a **Settings → Project Rules**
2. Activar las reglas deseadas
3. Usar `@Cursor Rules` en chat para forzar aplicación

### Por Archivo
Las reglas se aplican automáticamente según:
- Patrones `globs` definidos
- Contexto del archivo actual
- Configuración `applyIntelligently`

## Casos de Uso Recomendados

### Usar Cursor Rules cuando:
- Quieres que el IDE siempre siga tus normas
- Necesitas aplicar estándares de código consistentes
- Trabajas en un proyecto con convenciones específicas
- Quieres guiar automáticamente la generación de código

### Usar Claude Subagents cuando:
- Necesitas delegar una tarea específica y compleja
- Quieres un agente especializado con contexto separado
- Trabajas en tareas que requieren expertise profundo
- Necesitas producir entregables completos

## Conversión: Claude Subagents → Cursor Rules

Para convertir un subagente de Claude Code a reglas de Cursor:

1. **Analizar capacidades**: Identificar las capacidades del subagente
2. **Crear reglas específicas**: Convertir capacidades en reglas accionables
3. **Definir contexto**: Establecer `globs` apropiados
4. **Modularizar**: Dividir en reglas pequeñas y específicas
5. **Probar**: Verificar que las reglas funcionen como esperado

Ver `docs/conversion-guide.md` para ejemplos detallados.

## Recursos

- [Documentación oficial de Cursor Rules](https://cursor.com/docs/context/rules)
- [Comunidad de Cursor](https://forum.cursor.com/)
- [Mejores prácticas en Playbooks](https://playbooks.com/rules/create-rules)
