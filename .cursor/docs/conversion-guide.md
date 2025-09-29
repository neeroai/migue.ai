# Guía de Conversión: Claude Subagents → Cursor Rules

Esta guía detalla cómo convertir un subagente de Claude Code (`.claude/agents/*.md`) a reglas de Cursor (`.cursor/rules/*.mdc`).

## Proceso de Conversión

### 1. Análisis del Subagente Original

Antes de convertir, analiza el subagente de Claude Code:

```markdown
# Ejemplo: frontend-developer.md (Claude)
---
name: frontend-developer
description: Build React components, implement responsive layouts...
model: sonnet
---

## Capabilities
- React 19 features including Actions, Server Components
- Next.js 15 App Router with Server Components
- Performance optimization and Core Web Vitals
- Accessibility WCAG 2.1/2.2 AA compliance
```

**Identificar elementos clave:**
- **Propósito**: ¿Qué hace el subagente?
- **Capacidades**: ¿Qué tecnologías domina?
- **Herramientas**: ¿Qué herramientas usa?
- **Comportamiento**: ¿Cómo responde?

### 2. Estructura del Archivo .mdc

Un archivo `.mdc` de Cursor tiene esta estructura:

```markdown
---
description: Descripción de la regla
globs: ["patrones", "de", "archivos"]
applyIntelligently: true
priority: high|medium|low
---

rule: Primera regla específica
rule: Segunda regla específica
rule: Tercera regla específica
```

### 3. Conversión de Metadatos

| Claude Subagent | Cursor Rules |
|-----------------|--------------|
| `name` | `description` |
| `description` | `description` (expandido) |
| `model` | No aplica (Cursor usa su modelo) |
| N/A | `globs` (nuevo) |
| N/A | `applyIntelligently` (nuevo) |
| N/A | `priority` (nuevo) |

### 4. Conversión de Capacidades a Reglas

**Antes (Claude Subagent):**
```markdown
### Core React Expertise
- React 19 features including Actions, Server Components
- Concurrent rendering and Suspense patterns
- Advanced hooks (useActionState, useOptimistic)
```

**Después (Cursor Rules):**
```markdown
rule: Usar React 19 features cuando aplique: Actions, Server Components, y concurrent rendering
rule: Implementar Suspense boundaries para streaming de datos y manejo de loading states
rule: Aplicar hooks avanzados (useActionState, useOptimistic) para mejor UX en formularios
```

### 5. Definición de Contexto (globs)

Los `globs` definen cuándo se aplican las reglas:

```yaml
# Para desarrollo frontend
globs:
  - "app/**"           # Next.js App Router
  - "components/**"    # Componentes React
  - "src/**/*.tsx"     # Archivos TypeScript React
  - "pages/**"         # Páginas (si usas Pages Router)
  - "styles/**"        # Archivos de estilos
```

### 6. Configuración de Aplicación

```yaml
applyIntelligently: true  # Recomendado: solo cuando sea relevante
priority: high           # Para reglas críticas
```

## Ejemplo Completo de Conversión

### Subagente Original (Claude)
```markdown
---
name: frontend-developer
description: Build React components, implement responsive layouts...
model: sonnet
---

## Purpose
Expert frontend developer specializing in React 19+, Next.js 15+...

## Capabilities
### Core React Expertise
- React 19 features including Actions, Server Components
- Concurrent rendering and Suspense patterns
- Advanced hooks (useActionState, useOptimistic)

### Next.js & Full-Stack Integration
- Next.js 15 App Router with Server Components
- Server Actions for seamless client-server data mutations
- Edge runtime and middleware configuration

### Performance & Optimization
- Core Web Vitals optimization (LCP, FID, CLS)
- Image optimization and lazy loading strategies
- Bundle analysis and tree shaking
```

### Reglas Convertidas (Cursor)
```markdown
---
description: Reglas para desarrollo frontend con React 19, Next.js 15, optimización de performance y accesibilidad
globs:
  - "app/**"
  - "components/**"
  - "src/**/*.tsx"
  - "pages/**"
  - "styles/**"
applyIntelligently: true
priority: high
---

rule: Preferir Server Components y Server Actions cuando aplique. Si el componente necesita estado/efectos/refs, marcarlo como "use client"
rule: Optimizar Core Web Vitals (LCP <2.5s, CLS <0.1, INP <200ms). Usar imágenes optimizadas, lazy loading, fuentes variables y next/image
rule: Implementar accesibilidad WCAG 2.1 AA: roles ARIA, navegación por teclado, contraste adecuado, labels en formularios
rule: Usar Suspense/streaming para datos; dividir por límites de carga y manejo de errores con error boundaries
rule: Estilos con Tailwind CSS; animaciones con Framer Motion; mantener componentes puros y memoizar cuando sea necesario
rule: Datos: React Query/SWR donde corresponda; preferir mutaciones con Server Actions y optimistic UI
rule: Testing mínimo: React Testing Library + Jest en componentes; e2e con Playwright en flujos críticos
rule: Documentar props y variantes en Storybook; añadir ejemplos de uso y casos edge
rule: Si el usuario pide ejemplos, devolver código TypeScript completo con notas de accesibilidad y SEO
```

## Estrategias de Modularización

### Opción 1: Un Archivo Grande
```markdown
# frontend-developer.mdc
---
description: Todas las reglas de frontend
globs: ["app/**", "components/**", ...]
---
rule: Regla 1
rule: Regla 2
...
```

### Opción 2: Archivos Módulares (Recomendado)
```markdown
# frontend-performance.mdc
---
description: Optimización de performance y Core Web Vitals
globs: ["app/**", "components/**"]
---

# frontend-a11y.mdc
---
description: Accesibilidad y WCAG compliance
globs: ["app/**", "components/**"]
---

# frontend-react.mdc
---
description: Patrones React 19 y Next.js 15
globs: ["app/**", "components/**"]
---
```

## Mejores Prácticas para la Conversión

### 1. Granularidad
- **Evitar**: Reglas muy generales
- **Preferir**: Reglas específicas y accionables

### 2. Contexto
- **Usar globs apropiados**: Solo archivos relevantes
- **applyIntelligently: true**: Para aplicación contextual

### 3. Lenguaje
- **Imperativo**: "Usar", "Implementar", "Preferir"
- **Específico**: Incluir tecnologías y versiones
- **Accionable**: Que se pueda aplicar directamente

### 4. Organización
- **Agrupar por tema**: Performance, A11y, React, etc.
- **Prioridades claras**: `priority: high` para reglas críticas
- **Documentación**: Incluir ejemplos cuando sea necesario

## Activación y Pruebas

### 1. Activar Reglas
```bash
# En Cursor IDE
Settings → Project Rules → Activar reglas deseadas
```

### 2. Probar Reglas
- Editar archivos que coincidan con `globs`
- Usar `@Cursor Rules` en chat
- Verificar que las reglas se aplican correctamente

### 3. Ajustar si es Necesario
- Refinar `globs` si se aplican incorrectamente
- Ajustar `applyIntelligently` si es necesario
- Modificar reglas según feedback

## Casos de Uso Específicos

### Para Proyectos React/Next.js
```yaml
globs:
  - "app/**"
  - "components/**"
  - "src/**/*.tsx"
  - "pages/**"
```

### Para Proyectos Vue
```yaml
globs:
  - "src/components/**"
  - "src/views/**"
  - "src/**/*.vue"
```

### Para Proyectos Angular
```yaml
globs:
  - "src/app/**"
  - "src/components/**"
  - "src/**/*.component.ts"
```

## Troubleshooting

### Problema: Las reglas no se aplican
**Solución**: Verificar `globs` y activación en Project Rules

### Problema: Reglas se aplican demasiado
**Solución**: Usar `applyIntelligently: true` y refinar `globs`

### Problema: Conflicto entre reglas
**Solución**: Ajustar `priority` y ser más específico en las reglas

## Recursos Adicionales

- [Documentación oficial de Cursor Rules](https://cursor.com/docs/context/rules)
- [Comunidad de Cursor](https://forum.cursor.com/)
- [Ejemplos de reglas en Playbooks](https://playbooks.com/rules/create-rules)
