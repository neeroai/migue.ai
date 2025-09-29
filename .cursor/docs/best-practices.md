# Mejores Prácticas para Cursor Rules (.mdc)

Esta guía detalla las mejores prácticas para crear y mantener archivos `.mdc` efectivos en Cursor Rules.

## Estructura de Archivos .mdc

### Front-matter Obligatorio
```yaml
---
description: Descripción clara y concisa de la regla
globs: ["patrones", "de", "archivos"]
applyIntelligently: true
priority: high|medium|low
---
```

### Bloques de Reglas
```markdown
rule: Descripción clara y accionable
rule: Otra regla específica
```

## Mejores Prácticas Generales

### 1. Descripción Clara
```yaml
# ✅ Buena
description: Reglas para desarrollo frontend con React 19, Next.js 15 y optimización de performance

# ❌ Mala
description: Frontend stuff
```

### 2. Globs Específicos
```yaml
# ✅ Buena - Específica para React/Next.js
globs:
  - "app/**"
  - "components/**"
  - "src/**/*.tsx"
  - "pages/**"

# ❌ Mala - Demasiado amplia
globs:
  - "**/*"
```

### 3. Aplicación Inteligente
```yaml
# ✅ Recomendado
applyIntelligently: true

# ❌ Solo si es absolutamente necesario
alwaysApply: true
```

### 4. Prioridades Apropiadas
```yaml
# ✅ Crítico para el proyecto
priority: high

# ✅ Importante pero no crítico
priority: medium

# ✅ Opcional o específico
priority: low
```

## Patrones de Reglas Efectivas

### 1. Reglas Específicas y Accionables
```markdown
# ✅ Buena
rule: Usar Server Components por defecto, marcar como "use client" solo cuando necesites estado, efectos o refs

# ❌ Mala
rule: Usar React bien
```

### 2. Incluir Tecnologías y Versiones
```markdown
# ✅ Buena
rule: Implementar React 19 features: useActionState para formularios, useOptimistic para UI optimista

# ❌ Mala
rule: Usar hooks modernos
```

### 3. Incluir Métricas Específicas
```markdown
# ✅ Buena
rule: Optimizar Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms usando next/image y lazy loading

# ❌ Mala
rule: Hacer el sitio rápido
```

### 4. Proporcionar Contexto
```markdown
# ✅ Buena
rule: Implementar accesibilidad WCAG 2.1 AA: roles ARIA apropiados, navegación por teclado, contraste 4.5:1 mínimo

# ❌ Mala
rule: Hacer accesible
```

## Organización de Archivos

### Estrategia 1: Un Archivo por Dominio
```
.cursor/rules/
├── frontend-performance.mdc
├── frontend-a11y.mdc
├── frontend-react.mdc
├── backend-api.mdc
└── testing.mdc
```

### Estrategia 2: Un Archivo por Rol
```
.cursor/rules/
├── frontend-developer.mdc
├── backend-developer.mdc
├── devops-engineer.mdc
└── qa-tester.mdc
```

### Estrategia 3: Híbrida (Recomendada)
```
.cursor/rules/
├── roles/
│   ├── frontend-developer.mdc
│   └── backend-developer.mdc
├── domains/
│   ├── performance.mdc
│   ├── accessibility.mdc
│   └── security.mdc
└── projects/
    ├── valo-banking.mdc
    └── neero-ai.mdc
```

## Patrones de Globs

### Para Proyectos React/Next.js
```yaml
globs:
  - "app/**"                    # Next.js App Router
  - "components/**"             # Componentes compartidos
  - "src/**/*.tsx"             # Componentes React TypeScript
  - "pages/**"                 # Páginas (Pages Router)
  - "styles/**"                # Archivos de estilos
  - "public/**"                # Assets públicos
```

### Para Proyectos Vue
```yaml
globs:
  - "src/components/**"         # Componentes Vue
  - "src/views/**"             # Vistas
  - "src/**/*.vue"             # Archivos Vue
  - "src/assets/**"            # Assets
```

### Para Proyectos Angular
```yaml
globs:
  - "src/app/**"               # Módulo principal
  - "src/components/**"        # Componentes
  - "src/**/*.component.ts"    # Componentes TypeScript
  - "src/**/*.service.ts"      # Servicios
```

### Para APIs/Backend
```yaml
globs:
  - "api/**"                   # Rutas de API
  - "src/**/*.controller.ts"   # Controladores
  - "src/**/*.service.ts"      # Servicios
  - "src/**/*.middleware.ts"   # Middleware
```

## Ejemplos de Reglas por Dominio

### Performance
```markdown
---
description: Optimización de performance y Core Web Vitals
globs: ["app/**", "components/**", "pages/**"]
applyIntelligently: true
priority: high
---

rule: Optimizar Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms
rule: Usar next/image para todas las imágenes con lazy loading
rule: Implementar code splitting con dynamic imports para rutas
rule: Usar fuentes variables y preload de fuentes críticas
rule: Minimizar bundle size con tree shaking y análisis de dependencias
```

### Accesibilidad
```markdown
---
description: Accesibilidad WCAG 2.1 AA y mejores prácticas
globs: ["app/**", "components/**", "pages/**"]
applyIntelligently: true
priority: high
---

rule: Implementar navegación por teclado en todos los componentes interactivos
rule: Usar roles ARIA apropiados y labels descriptivos
rule: Mantener contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
rule: Incluir skip links y landmarks para navegación
rule: Probar con screen readers y herramientas de accesibilidad
```

### React/Next.js
```markdown
---
description: Patrones React 19 y Next.js 15 con App Router
globs: ["app/**", "components/**", "src/**/*.tsx"]
applyIntelligently: true
priority: high
---

rule: Preferir Server Components, usar "use client" solo cuando necesites estado/efectos/refs
rule: Implementar Server Actions para mutaciones de datos
rule: Usar Suspense boundaries para streaming y loading states
rule: Aplicar React 19 features: useActionState, useOptimistic, useTransition
rule: Seguir App Router patterns: layouts, loading.tsx, error.tsx
```

### Testing
```markdown
---
description: Estrategias de testing para componentes y flujos
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"]
applyIntelligently: true
priority: medium
---

rule: Escribir tests unitarios con React Testing Library para componentes
rule: Implementar tests de integración para flujos de usuario críticos
rule: Usar Playwright para e2e tests en flujos principales
rule: Mantener cobertura de tests >80% para componentes críticos
rule: Incluir tests de accesibilidad con jest-axe
```

## Comunicación entre Reglas

### Evitar Conflictos
```markdown
# En frontend-performance.mdc
rule: Usar next/image para optimización

# En frontend-a11y.mdc  
rule: Incluir alt text descriptivo en todas las imágenes
```

### Complementar Reglas
```markdown
# En frontend-react.mdc
rule: Usar Server Components por defecto

# En frontend-performance.mdc
rule: Server Components mejoran performance al reducir JavaScript del cliente
```

## Mantenimiento y Evolución

### 1. Revisión Regular
- Revisar reglas mensualmente
- Actualizar según nuevas versiones de tecnologías
- Eliminar reglas obsoletas

### 2. Feedback del Equipo
- Recopilar feedback sobre efectividad
- Ajustar reglas según problemas encontrados
- Documentar casos de uso exitosos

### 3. Versionado
```markdown
# Incluir versión en descripción
description: Reglas frontend v2.1 - React 19, Next.js 15, performance optimizada
```

### 4. Documentación
- Incluir ejemplos en reglas complejas
- Documentar decisiones de diseño
- Mantener changelog de reglas

## Troubleshooting Común

### Problema: Reglas no se aplican
```yaml
# Verificar
globs: ["app/**"]  # ¿Coincide con archivos actuales?
applyIntelligently: true  # ¿Está activado?
```

### Problema: Reglas se aplican demasiado
```yaml
# Refinar globs
globs: ["components/ui/**"]  # Más específico
# O usar applyIntelligently: true
```

### Problema: Conflictos entre reglas
```yaml
# Ajustar prioridades
priority: high    # Para regla crítica
priority: medium  # Para regla importante
```

### Problema: Reglas demasiado genéricas
```markdown
# Antes
rule: Hacer código limpio

# Después
rule: Usar TypeScript strict mode, ESLint con reglas de React, Prettier para formato
```

## Recursos y Referencias

### Documentación Oficial
- [Cursor Rules Documentation](https://cursor.com/docs/context/rules)
- [Cursor Community Forum](https://forum.cursor.com/)

### Herramientas de Validación
- [Glob Tester](https://globster.xyz/) - Para probar patrones glob
- [MDC Validator](https://github.com/cursor-ai/cursor-rules-validator) - Para validar formato

### Ejemplos de la Comunidad
- [Cursor Rules Playbooks](https://playbooks.com/rules/create-rules)
- [Awesome Cursor Rules](https://github.com/cursor-ai/awesome-cursor-rules)

### Mejores Prácticas por Tecnología
- [React Best Practices](https://react.dev/learn)
- [Next.js Best Practices](https://nextjs.org/docs)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Performance Best Practices](https://web.dev/performance/)
