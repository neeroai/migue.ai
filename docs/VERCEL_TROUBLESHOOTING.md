# Vercel Deployment Troubleshooting

## Error: "No Output Directory named 'public' found"

### ❌ Síntoma
```
Error: No Output Directory named "public" found after the Build completed.
Configure the Output Directory in your Project Settings.
```

El build de Next.js se completa exitosamente, pero Vercel busca un directorio `public/` como output en lugar de `.next/`.

### 🔍 Causa Raíz

Vercel está configurado con **Framework Preset = "Other"** en lugar de **"Next.js"**.

Cuando está en "Other":
- ❌ Busca `public/` como output directory (para sitios estáticos)
- ❌ No aplica optimizaciones de Next.js
- ❌ No reconoce `.next/` como directorio de build válido

### ✅ Solución 1: Automática (vercel.json)

**YA APLICADA** - Commit `67ac06b`

Agregado `"framework": "nextjs"` en `vercel.json` para forzar detección automática.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  ...
}
```

**Próximo deployment** debería detectar Next.js automáticamente.

---

### ✅ Solución 2: Manual (Vercel Dashboard)

Si la Solución 1 no funciona, configura manualmente en Vercel Dashboard:

#### Paso 1: Ir a Project Settings
```
https://vercel.com/[tu-equipo]/migue-ai/settings
```

#### Paso 2: Build & Development Settings
1. Navega a: **Settings** → **General** → **Build & Development Settings**
2. Encuentra: **Framework Preset**
3. Cambia de: **Other** → **Next.js**
4. Guarda cambios

#### Paso 3: Configuración Correcta

Después del cambio, debe verse así:

```
Framework Preset: Next.js
Build Command: (leave empty or 'npm run build')
Output Directory: (leave empty)
Install Command: npm install
Development Command: npm run dev
```

**IMPORTANTE:**
- ✅ **Output Directory**: Déjalo VACÍO para Next.js
- ✅ **Build Command**: Vacío o `npm run build`
- ❌ NO especificar `public/` o `.next/` manualmente

#### Paso 4: Redeploy

Después de cambiar la configuración:

1. Ve a **Deployments**
2. Encuentra el último deployment fallido
3. Click en **⋯** (tres puntos) → **Redeploy**

O simplemente push un commit nuevo:
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

---

## 📊 Verificación Post-Deployment

### Build Logs Exitosos Deben Mostrar:

```
✓ Building Next.js
✓ Generating static pages (4/4)
✓ Finalizing page optimization
✓ Collecting build traces
✓ Route (app)
✓ (Static) prerendered as static content
✓ Deployment Ready
```

### URLs a Verificar:

```bash
# Homepage
https://migue.app/

# API Endpoints
https://migue.app/api/whatsapp/webhook
https://migue.app/api/whatsapp/send
https://migue.app/api/cron/check-reminders
```

---

## 🔧 Configuración Final Correcta

### vercel.json
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [...],
  "headers": [...]
}
```

### next.config.mjs
```javascript
const nextConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }
};
```

### Vercel Dashboard
```
Framework Preset: Next.js ✅
Output Directory: (empty) ✅
```

---

## 🚀 Optimizaciones Aplicadas

| Optimización | Descripción | Commit |
|--------------|-------------|--------|
| `.vercelignore` | Excluir 153 archivos innecesarios | `c0cc70d` |
| Tailwind v4 | Migración a CSS-first config | `2267a5c` |
| Framework detection | Forzar Next.js preset | `67ac06b` |

**Resultado Esperado:**
- ⏱️ Build time: ~50-70% más rápido
- 📦 Files deployed: ~25 archivos (vs 178 originales)
- ✅ Zero configuration errors

---

## 📞 Soporte

Si después de aplicar ambas soluciones el error persiste:

1. Verifica que `next.config.mjs` existe y es válido
2. Verifica que `package.json` tiene `"next": "^15.5.4"`
3. Limpia cache de Vercel: Dashboard → Settings → Advanced → Clear Cache
4. Contacta soporte de Vercel con el deployment URL

---

**Última actualización:** 2025-09-30
**Commits relacionados:** `c0cc70d`, `2267a5c`, `a141f66`, `67ac06b`
