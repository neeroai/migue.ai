# Ejemplo de Conversión: frontend-developer.md → frontend-developer.mdc

Este documento muestra la conversión completa del subagente `frontend-developer.md` de Claude Code a reglas de Cursor en formato `.mdc`.

## Archivo Original (Claude Subagent)

**Ubicación**: `.claude/agents/frontend-developer.md`

```markdown
---
name: frontend-developer
description: Build React components, implement responsive layouts, and handle client-side state management. Masters React 19, Next.js 15, and modern frontend architecture. Optimizes performance and ensures accessibility. Use PROACTIVELY when creating UI components or fixing frontend issues.
model: sonnet
---

You are a frontend development expert specializing in modern React applications, Next.js, and cutting-edge frontend architecture.

## Purpose
Expert frontend developer specializing in React 19+, Next.js 15+, and modern web application development. Masters both client-side and server-side rendering patterns, with deep knowledge of the React ecosystem including RSC, concurrent features, and advanced performance optimization.

## Capabilities

### Core React Expertise
- React 19 features including Actions, Server Components, and async transitions
- Concurrent rendering and Suspense patterns for optimal UX
- Advanced hooks (useActionState, useOptimistic, useTransition, useDeferredValue)
- Component architecture with performance optimization (React.memo, useMemo, useCallback)
- Custom hooks and hook composition patterns
- Error boundaries and error handling strategies
- React DevTools profiling and optimization techniques

### Next.js & Full-Stack Integration
- Next.js 15 App Router with Server Components and Client Components
- React Server Components (RSC) and streaming patterns
- Server Actions for seamless client-server data mutations
- Advanced routing with parallel routes, intercepting routes, and route handlers
- Incremental Static Regeneration (ISR) and dynamic rendering
- Edge runtime and middleware configuration
- Image optimization and Core Web Vitals optimization
- API routes and serverless function patterns

### Performance & Optimization
- Core Web Vitals optimization (LCP, FID, CLS)
- Advanced code splitting and dynamic imports
- Image optimization and lazy loading strategies
- Font optimization and variable fonts
- Memory leak prevention and performance monitoring
- Bundle analysis and tree shaking
- Critical resource prioritization
- Service worker caching strategies

### Accessibility & Inclusive Design
- WCAG 2.1/2.2 AA compliance implementation
- ARIA patterns and semantic HTML
- Keyboard navigation and focus management
- Screen reader optimization
- Color contrast and visual accessibility
- Accessible form patterns and validation
- Inclusive design principles
```

## Archivo Convertido (Cursor Rules)

**Ubicación**: `.cursor/rules/frontend-developer-converted.mdc`

```markdown
---
description: Experto en desarrollo frontend con React 19, Next.js 15, optimización de performance, accesibilidad WCAG 2.1 AA y mejores prácticas modernas
globs:
  - "app/**"
  - "components/**"
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "pages/**"
  - "styles/**"
  - "public/**"
applyIntelligently: true
priority: high
---

# React 19 y Next.js 15
rule: Preferir Server Components por defecto, marcar como "use client" solo cuando necesites estado, efectos, refs o event handlers
rule: Implementar Server Actions para mutaciones de datos en lugar de API routes cuando sea posible
rule: Usar React 19 features: useActionState para formularios, useOptimistic para UI optimista, useTransition para transiciones
rule: Aplicar App Router patterns: layouts anidados, loading.tsx, error.tsx, not-found.tsx para mejor UX
rule: Implementar streaming con Suspense boundaries para datos y loading states granulares

# Performance y Core Web Vitals
rule: Optimizar Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms usando next/image, lazy loading y fuentes variables
rule: Usar next/image para todas las imágenes con lazy loading, placeholder blur y responsive images
rule: Implementar code splitting con dynamic imports para rutas y componentes pesados
rule: Minimizar bundle size con tree shaking, análisis de dependencias y eliminación de código muerto
rule: Usar fuentes variables y preload de fuentes críticas para mejorar FCP y LCP

# Accesibilidad WCAG 2.1 AA
rule: Implementar navegación por teclado completa en todos los componentes interactivos
rule: Usar roles ARIA apropiados, labels descriptivos y anuncios para screen readers
rule: Mantener contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande (18pt+)
rule: Incluir skip links, landmarks y estructura semántica para navegación
rule: Probar con screen readers y herramientas de accesibilidad antes de deployment

# Estado y Datos
rule: Usar React Query/TanStack Query para server state, Context API para client state simple
rule: Implementar optimistic updates para mejor UX en formularios y mutaciones
rule: Aplicar proper error handling con error boundaries y fallbacks user-friendly
rule: Usar Zustand para estado complejo del cliente, Redux Toolkit solo si es necesario
rule: Implementar proper loading states y skeleton screens para mejor perceived performance

# Estilos y Diseño
rule: Usar Tailwind CSS para styling con design tokens y responsive design mobile-first
rule: Implementar dark mode con CSS custom properties y theme switching
rule: Usar Framer Motion para animaciones suaves y performantes
rule: Aplicar CSS Grid y Flexbox para layouts modernos y responsive
rule: Mantener design system consistente con componentes reutilizables

# Testing y Calidad
rule: Escribir tests unitarios con React Testing Library para componentes críticos
rule: Implementar tests de integración para flujos de usuario importantes
rule: Usar Playwright para e2e tests en flujos principales del negocio
rule: Mantener cobertura de tests >85% para componentes y hooks críticos
rule: Incluir tests de accesibilidad con jest-axe y validación de WCAG

# TypeScript y DX
rule: Usar TypeScript strict mode con noImplicitAny, strictNullChecks habilitados
rule: Definir interfaces claras para props, estado y datos de API
rule: Usar generics apropiadamente para componentes reutilizables
rule: Implementar proper error types y error handling con Result patterns
rule: Mantener imports organizados con path aliases y barrel exports

# SEO y Meta Tags
rule: Implementar proper meta tags, Open Graph y Twitter Cards para cada página
rule: Usar structured data (JSON-LD) para mejor SEO y rich snippets
rule: Optimizar URLs, headings hierarchy y internal linking
rule: Implementar sitemap.xml y robots.txt apropiados
rule: Usar next/head para meta tags dinámicos y next-seo para configuración

# Build y Deployment
rule: Configurar ESLint con reglas de React, Prettier para formato y Husky para git hooks
rule: Usar GitHub Actions para CI/CD con tests, linting y deployment automático
rule: Implementar proper environment variables y secrets management
rule: Configurar monitoring y error tracking (Sentry, LogRocket) para producción
rule: Optimizar bundle con webpack-bundle-analyzer y performance budgets

# Componentes y Arquitectura
rule: Seguir Atomic Design principles: atoms, molecules, organisms, templates, pages
rule: Crear componentes puros, memoizar con React.memo cuando sea necesario
rule: Implementar proper prop validation y default values
rule: Usar custom hooks para lógica reutilizable y separación de concerns
rule: Mantener componentes pequeños, enfocados y con responsabilidad única

# Formularios y Validación
rule: Implementar formularios accesibles con proper labels, error messages y validation
rule: Usar react-hook-form para performance y validación eficiente
rule: Aplicar proper form validation con libraries como zod o yup
rule: Implementar loading states, error handling y success feedback en formularios
rule: Usar controlled components y proper state management para formularios complejos

# PWA y Offline
rule: Implementar Service Worker para caching y offline functionality
rule: Configurar Web App Manifest para instalación como PWA
rule: Usar cache-first strategy para assets estáticos, network-first para datos dinámicos
rule: Implementar proper offline fallbacks y error handling
rule: Configurar push notifications y background sync cuando sea apropiado

# Ejemplos y Código
rule: Cuando el usuario pida ejemplos, proporcionar código TypeScript completo y funcional
rule: Incluir comentarios explicativos para patrones complejos y decisiones de diseño
rule: Mostrar tanto el componente como sus tests y stories de Storybook
rule: Incluir notas sobre accesibilidad, performance y SEO en ejemplos
rule: Probar alternativas y trade-offs cuando sea relevante
```

## Análisis de la Conversión

### 1. Transformación de Metadatos

| Elemento Original | Elemento Convertido | Cambio |
|------------------|-------------------|---------|
| `name: frontend-developer` | `description: Experto en desarrollo frontend...` | Expandido para ser más descriptivo |
| `description: Build React components...` | Integrado en `description` | Combinado con propósito |
| `model: sonnet` | Eliminado | No aplica en Cursor |
| N/A | `globs: ["app/**", "components/**"...]` | Nuevo: define contexto |
| N/A | `applyIntelligently: true` | Nuevo: aplicación inteligente |
| N/A | `priority: high` | Nuevo: prioridad de la regla |

### 2. Transformación de Capacidades a Reglas

#### Antes (Capacidades)
```markdown
### Core React Expertise
- React 19 features including Actions, Server Components, and async transitions
- Concurrent rendering and Suspense patterns for optimal UX
- Advanced hooks (useActionState, useOptimistic, useTransition, useDeferredValue)
```

#### Después (Reglas)
```markdown
rule: Preferir Server Components por defecto, marcar como "use client" solo cuando necesites estado, efectos, refs o event handlers
rule: Implementar Server Actions para mutaciones de datos en lugar de API routes cuando sea posible
rule: Usar React 19 features: useActionState para formularios, useOptimistic para UI optimista, useTransition para transiciones
```

### 3. Principios de Conversión Aplicados

#### Especificidad
- **Antes**: "React 19 features including Actions, Server Components"
- **Después**: "Usar React 19 features: useActionState para formularios, useOptimistic para UI optimista"

#### Accionabilidad
- **Antes**: "Advanced hooks (useActionState, useOptimistic, useTransition, useDeferredValue)"
- **Después**: "Usar React 19 features: useActionState para formularios, useOptimistic para UI optimista, useTransition para transiciones"

#### Contexto
- **Antes**: Capacidades generales
- **Después**: Reglas específicas con `globs` que definen cuándo aplicar

### 4. Organización por Dominios

La conversión organizó las reglas en dominios específicos:

1. **React 19 y Next.js 15** - Tecnologías core
2. **Performance y Core Web Vitals** - Optimización
3. **Accesibilidad WCAG 2.1 AA** - Compliance
4. **Estado y Datos** - Gestión de estado
5. **Estilos y Diseño** - UI/UX
6. **Testing y Calidad** - QA
7. **TypeScript y DX** - Developer Experience
8. **SEO y Meta Tags** - SEO
9. **Build y Deployment** - DevOps
10. **Componentes y Arquitectura** - Patrones
11. **Formularios y Validación** - UX específica
12. **PWA y Offline** - Progressive Web Apps
13. **Ejemplos y Código** - Comunicación

### 5. Ventajas de la Conversión

#### Para Claude Subagents:
- **Especialización**: Agente dedicado con contexto separado
- **Delegación**: Toma control completo de tareas específicas
- **Autonomía**: Puede trabajar independientemente

#### Para Cursor Rules:
- **Integración**: Se aplica automáticamente en el IDE
- **Contexto**: Conoce el proyecto y archivos actuales
- **Consistencia**: Aplica estándares en todo el proyecto
- **Eficiencia**: No requiere invocación manual

### 6. Casos de Uso Recomendados

#### Usar Claude Subagent cuando:
```bash
# Invocación manual para tareas complejas
@frontend-developer "Crea un DataTable accesible con sorting, paginación, TypeScript y Storybook"
```

#### Usar Cursor Rules cuando:
```bash
# Aplicación automática durante desarrollo
# Editar cualquier archivo .tsx en components/
# Las reglas se aplican automáticamente según globs
```

## Activación y Pruebas

### 1. Activar en Cursor
```bash
# En Cursor IDE
Settings → Project Rules → Activar "frontend-developer-converted"
```

### 2. Probar Reglas
```bash
# Crear archivo de prueba
touch components/Button.tsx

# Editar archivo - las reglas se aplican automáticamente
# Usar @Cursor Rules en chat para forzar aplicación
```

### 3. Verificar Funcionamiento
- Las reglas se aplican en archivos que coinciden con `globs`
- `applyIntelligently: true` asegura aplicación contextual
- `priority: high` da precedencia sobre otras reglas

## Conclusiones

Esta conversión demuestra cómo transformar un subagente de Claude Code en reglas efectivas de Cursor:

1. **Preserva el conocimiento**: Toda la expertise del subagente se mantiene
2. **Mejora la aplicabilidad**: Las reglas se aplican automáticamente
3. **Aumenta la consistencia**: Los estándares se aplican en todo el proyecto
4. **Optimiza el flujo de trabajo**: No requiere invocación manual

La conversión exitosa requiere entender las diferencias entre ambos sistemas y adaptar el contenido para maximizar la efectividad en cada contexto.
