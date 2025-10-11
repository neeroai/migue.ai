# WhatsApp Multi-Tenant Architecture

**Guía completa para construir chatbots WhatsApp multi-cliente con una sola app de Facebook**

---

## Tabla de Contenidos

- [Pregunta Frecuente](#pregunta-frecuente)
- [Arquitectura Overview](#arquitectura-overview)
- [Opciones de Implementación](#opciones-de-implementación)
- [Webhook Routing](#webhook-routing)
- [Base de Datos Multi-Tenant](#base-de-datos-multi-tenant)
- [Embedded Signup](#embedded-signup)
- [Validación de Firma](#validación-de-firma)
- [Implementación Práctica](#implementación-práctica)
- [Migración desde Single-Tenant](#migración-desde-single-tenant)
- [Comparación de Costos](#comparación-de-costos)
- [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)

---

## Pregunta Frecuente

### ¿Necesito crear una app de Facebook por cada cliente?

**NO.** Puedes usar **UNA sola app** de Facebook/Meta para gestionar **múltiples clientes** (WhatsApp Business Accounts).

### ¿Cómo manejo múltiples webhooks?

**Un solo webhook URL** recibe eventos de todos los clientes. Usas **routing interno** basado en `WABA_ID` y `PHONE_NUMBER_ID` del payload para dirigir el mensaje al cliente correcto.

---

## Arquitectura Overview

### Conceptos Clave

| Concepto | Descripción |
|----------|-------------|
| **Meta App** | Aplicación en developers.facebook.com (UNA para todos los clientes) |
| **WABA** | WhatsApp Business Account - Identificador único del cliente |
| **Phone Number ID** | ID del número de teléfono específico dentro del WABA |
| **Webhook URL** | URL única que recibe eventos de todos los WABA |
| **Tenant** | Cliente individual en tu sistema SaaS |

### Diagrama de Arquitectura

```
┌────────────────────────────────────────────────────────────────┐
│                  Meta WhatsApp Platform                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Cliente A   │  │  Cliente B   │  │  Cliente C   │        │
│  │  WABA_001    │  │  WABA_002    │  │  WABA_003    │        │
│  │  +5491...    │  │  +5492...    │  │  +5493...    │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                │
│                            │                                    │
│                    Webhooks (todos al mismo URL)               │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│           Vercel Edge Function: /api/whatsapp/webhook          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  1. Validar firma HMAC-SHA256                            │ │
│  │  2. Extraer WABA_ID del payload                          │ │
│  │  3. Buscar tenant en base de datos                       │ │
│  │  4. Aplicar configuración específica del tenant          │ │
│  │  5. Procesar mensaje con contexto del tenant             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                          │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │  tenants    │───▶│    users    │───▶│conversations│       │
│  │             │    │ tenant_id   │    │  tenant_id  │       │
│  │  waba_id    │    │ phone       │    │  user_id    │       │
│  │  token      │    │ name        │    │  messages   │       │
│  │  settings   │    │             │    │             │       │
│  └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                 │
│  Aislamiento de datos por tenant_id (Row Level Security)      │
└────────────────────────────────────────────────────────────────┘
```

---

## Opciones de Implementación

Meta ofrece dos modelos para proveedores de soluciones WhatsApp:

### 1. Tech Provider (Recomendado para SaaS)

**Características:**
- ✅ Una app gestiona múltiples WABA
- ✅ Embedded Signup para onboarding rápido (<5 min)
- ✅ Cada cliente tiene su propio token de acceso
- ✅ Billing separado por cliente
- ✅ Sin necesidad de aprobación especial de Meta

**Ideal para:**
- Plataformas SaaS de chatbots
- Soluciones white-label
- Startups y agencias
- migue.ai expandiéndose a múltiples clientes

**Tokens utilizados:**
- `Business Integration System User Access Token` - Para operaciones generales
- `User Access Token` - Token específico de cada cliente obtenido via OAuth

### 2. Solution Partner (BSP)

**Características:**
- ✅ Similar a Tech Provider
- ✅ Línea de crédito compartida con clientes
- ✅ Acceso a features empresariales
- ⚠️ Requiere aprobación como BSP (Business Solution Provider)
- ⚠️ Proceso de aplicación más largo

**Ideal para:**
- Empresas grandes con alto volumen
- Proveedores de telecomunicaciones
- Partners oficiales de Meta

**Tokens utilizados:**
- `System User Access Token` - Para compartir línea de crédito
- `Business Integration System User Access Token` - Para todo lo demás

---

## Webhook Routing

### Estructura del Payload de WhatsApp

Todos los webhooks de todos los clientes llegan al mismo URL:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_12345",  // ← Identificador del CLIENTE/TENANT
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15551234567",
              "phone_number_id": "PHONE_67890"  // ← Número específico
            },
            "contacts": [
              {
                "profile": { "name": "John Doe" },
                "wa_id": "15559876543"
              }
            ],
            "messages": [
              {
                "from": "15559876543",
                "id": "wamid.ABC123==",
                "timestamp": "1234567890",
                "type": "text",
                "text": { "body": "Hola!" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Campos Clave para Routing

| Campo | Ubicación | Uso |
|-------|-----------|-----|
| `entry[0].id` | Top-level | WABA ID del cliente |
| `metadata.phone_number_id` | Dentro de `value` | ID del número específico |
| `metadata.display_phone_number` | Dentro de `value` | Número visible (formato E.164) |

### Estrategia de Routing

```typescript
// Extraer identificadores del payload
const wabaId = payload.entry[0]?.id;
const phoneNumberId = payload.entry[0]?.changes[0]?.value?.metadata?.phone_number_id;

// Buscar configuración del tenant
const tenant = await getTenantByWABA(wabaId);

if (!tenant) {
  logger.warn('Unknown WABA received', { wabaId });
  return new Response('OK', { status: 200 }); // Siempre 200 para evitar retries
}

// Procesar con configuración específica del tenant
await processMessageForTenant(payload, tenant);
```

---

## Base de Datos Multi-Tenant

### Schema SQL

```sql
-- =====================================================
-- TABLA PRINCIPAL: tenants
-- =====================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificadores de WhatsApp
  waba_id VARCHAR(255) UNIQUE NOT NULL,  -- WhatsApp Business Account ID
  phone_number_id VARCHAR(255) NOT NULL,
  display_phone_number VARCHAR(20),

  -- Información del negocio
  business_name VARCHAR(255) NOT NULL,
  business_email VARCHAR(255),
  industry VARCHAR(100),

  -- Tokens y seguridad
  access_token TEXT NOT NULL,  -- OAuth token del cliente
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_verify_token VARCHAR(255),  -- Si se usa token único por tenant

  -- Estado y configuración
  status VARCHAR(50) DEFAULT 'active',  -- active, suspended, trial
  plan_type VARCHAR(50) DEFAULT 'free',  -- free, basic, pro, enterprise
  settings JSONB DEFAULT '{}',  -- Configuración específica del tenant

  -- WhatsApp Configuration
  business_verified BOOLEAN DEFAULT FALSE,
  quality_rating VARCHAR(50),  -- GREEN, YELLOW, RED
  messaging_limit_tier VARCHAR(50),  -- TIER_50, TIER_250, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  onboarded_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ
);

-- =====================================================
-- MODIFICAR TABLAS EXISTENTES
-- =====================================================

-- Agregar tenant_id a users
ALTER TABLE users
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a conversations_v2
ALTER TABLE conversations_v2
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a messages_v2
ALTER TABLE messages_v2
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a reminders
ALTER TABLE reminders
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a meetings
ALTER TABLE meetings
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a expenses
ALTER TABLE expenses
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índices en tabla tenants
CREATE INDEX idx_tenants_waba ON tenants(waba_id);
CREATE INDEX idx_tenants_phone_number ON tenants(phone_number_id);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Índices en tablas existentes
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_conversations_tenant ON conversations_v2(tenant_id);
CREATE INDEX idx_messages_tenant ON messages_v2(tenant_id);
CREATE INDEX idx_reminders_tenant ON reminders(tenant_id);
CREATE INDEX idx_meetings_tenant ON meetings(tenant_id);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);

-- Índices compuestos para queries comunes
CREATE INDEX idx_users_tenant_phone ON users(tenant_id, phone_number);
CREATE INDEX idx_conversations_tenant_user ON conversations_v2(tenant_id, user_id);
CREATE INDEX idx_messages_tenant_conv ON messages_v2(tenant_id, conversation_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (ejemplo para users)
CREATE POLICY "Users can only access their tenant data"
  ON users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Políticas para conversaciones
CREATE POLICY "Conversations isolated by tenant"
  ON conversations_v2
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- FUNCIONES HELPER
-- =====================================================

-- Función para establecer el tenant actual en el contexto
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener tenant por WABA
CREATE OR REPLACE FUNCTION get_tenant_by_waba(waba_id_param VARCHAR)
RETURNS TABLE (
  id UUID,
  business_name VARCHAR,
  access_token TEXT,
  settings JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.business_name, t.access_token, t.settings
  FROM tenants t
  WHERE t.waba_id = waba_id_param
  AND t.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VISTA: Métricas por Tenant
-- =====================================================

CREATE OR REPLACE VIEW tenant_metrics AS
SELECT
  t.id AS tenant_id,
  t.business_name,
  t.waba_id,
  t.plan_type,
  t.status,
  COUNT(DISTINCT u.id) AS total_users,
  COUNT(DISTINCT c.id) AS total_conversations,
  COUNT(DISTINCT m.id) AS total_messages,
  COUNT(DISTINCT r.id) AS total_reminders,
  COUNT(DISTINCT mt.id) AS total_meetings,
  MAX(m.created_at) AS last_message_at,
  t.created_at,
  t.onboarded_at
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
LEFT JOIN conversations_v2 c ON c.tenant_id = t.id
LEFT JOIN messages_v2 m ON m.tenant_id = t.id
LEFT JOIN reminders r ON r.tenant_id = t.id
LEFT JOIN meetings mt ON mt.tenant_id = t.id
GROUP BY t.id, t.business_name, t.waba_id, t.plan_type, t.status, t.created_at, t.onboarded_at;

-- =====================================================
-- TABLA: Tenant Usage Tracking
-- =====================================================

CREATE TABLE tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Métricas de uso
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- WhatsApp Metrics
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  conversations_initiated INTEGER DEFAULT 0,

  -- AI Metrics
  ai_requests INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,

  -- Costos
  whatsapp_cost_usd DECIMAL(10, 4) DEFAULT 0,
  ai_cost_usd DECIMAL(10, 4) DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, period_start)
);

CREATE INDEX idx_tenant_usage_tenant ON tenant_usage(tenant_id);
CREATE INDEX idx_tenant_usage_period ON tenant_usage(period_start, period_end);
```

### Helpers TypeScript

```typescript
// lib/multi-tenant.ts

import { getSupabaseServerClient } from './supabase';

export interface Tenant {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  businessName: string;
  accessToken: string;
  settings: Record<string, any>;
  status: 'active' | 'suspended' | 'trial';
  planType: 'free' | 'basic' | 'pro' | 'enterprise';
}

/**
 * Obtener tenant por WABA ID
 */
export async function getTenantByWABA(wabaId: string): Promise<Tenant | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('waba_id', wabaId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    wabaId: data.waba_id,
    phoneNumberId: data.phone_number_id,
    businessName: data.business_name,
    accessToken: data.access_token,
    settings: data.settings || {},
    status: data.status,
    planType: data.plan_type,
  };
}

/**
 * Obtener tenant por Phone Number ID
 */
export async function getTenantByPhoneNumber(phoneNumberId: string): Promise<Tenant | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    wabaId: data.waba_id,
    phoneNumberId: data.phone_number_id,
    businessName: data.business_name,
    accessToken: data.access_token,
    settings: data.settings || {},
    status: data.status,
    planType: data.plan_type,
  };
}

/**
 * Establecer contexto del tenant para RLS
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase.rpc('set_current_tenant', { tenant_uuid: tenantId });
}

/**
 * Crear nuevo tenant (onboarding)
 */
export async function createTenant(params: {
  wabaId: string;
  phoneNumberId: string;
  businessName: string;
  accessToken: string;
  displayPhoneNumber?: string;
}): Promise<Tenant> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      waba_id: params.wabaId,
      phone_number_id: params.phoneNumberId,
      business_name: params.businessName,
      access_token: params.accessToken,
      display_phone_number: params.displayPhoneNumber,
      status: 'active',
      plan_type: 'free',
      onboarded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create tenant: ${error?.message}`);
  }

  return {
    id: data.id,
    wabaId: data.waba_id,
    phoneNumberId: data.phone_number_id,
    businessName: data.business_name,
    accessToken: data.access_token,
    settings: data.settings || {},
    status: data.status,
    planType: data.plan_type,
  };
}
```

---

## Embedded Signup

Embedded Signup permite que tus clientes conecten su WhatsApp Business Account en minutos sin salir de tu aplicación.

### Flow Completo

```
1. Cliente hace clic en "Conectar WhatsApp"
   ↓
2. Redirige a Meta Embedded Signup (popup o redirect)
   ↓
3. Cliente inicia sesión en Facebook y autoriza permisos
   ↓
4. Meta redirige a tu callback URL con authorization code
   ↓
5. Tu backend intercambia code por access_token
   ↓
6. Obtienes WABA_ID y Phone_Number_ID del cliente
   ↓
7. Guardas tenant en base de datos
   ↓
8. Cliente ve dashboard y puede enviar mensajes
```

### Implementación

#### 1. Botón de Signup (Frontend)

```typescript
// components/WhatsAppConnect.tsx
'use client';

export function WhatsAppConnectButton() {
  const handleConnect = () => {
    const APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const REDIRECT_URI = encodeURIComponent(
      `${window.location.origin}/api/auth/whatsapp/callback`
    );
    const CONFIG_ID = process.env.NEXT_PUBLIC_EMBEDDED_SIGNUP_CONFIG_ID;

    const signupUrl = `https://www.facebook.com/v23.0/dialog/oauth?` +
      `client_id=${APP_ID}&` +
      `redirect_uri=${REDIRECT_URI}&` +
      `config_id=${CONFIG_ID}&` +
      `response_type=code&` +
      `scope=whatsapp_business_management,whatsapp_business_messaging&` +
      `state=${generateCSRFToken()}`;  // CSRF protection

    // Abrir en popup
    const popup = window.open(
      signupUrl,
      'WhatsApp Signup',
      'width=600,height=800'
    );

    // O redirigir en la misma ventana
    // window.location.href = signupUrl;
  };

  return (
    <button
      onClick={handleConnect}
      className="bg-green-600 text-white px-6 py-3 rounded-lg"
    >
      🟢 Conectar WhatsApp Business
    </button>
  );
}
```

#### 2. Callback Handler (Backend)

```typescript
// app/api/auth/whatsapp/callback/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // 1. Validar CSRF token
  if (!validateCSRFToken(state)) {
    return new Response('Invalid state', { status: 400 });
  }

  // 2. Manejar errores de OAuth
  if (error) {
    logger.error('OAuth error', { error });
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=${error}`
    );
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  try {
    // 3. Intercambiar code por access_token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v23.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_APP_ID}&` +
      `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
      `code=${code}`,
      { method: 'GET' }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // 4. Obtener información del WABA
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v23.0/debug_token?` +
      `input_token=${access_token}&` +
      `access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`,
      { method: 'GET' }
    );

    const debugData = await wabaResponse.json();
    const { granular_scopes, scopes } = debugData.data;

    // Verificar que tiene los permisos necesarios
    const hasMessaging = scopes?.includes('whatsapp_business_messaging');
    const hasManagement = scopes?.includes('whatsapp_business_management');

    if (!hasMessaging || !hasManagement) {
      throw new Error('Missing required WhatsApp permissions');
    }

    // 5. Obtener lista de WABA del usuario
    const accountsResponse = await fetch(
      `https://graph.facebook.com/v23.0/me/accounts`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const accountsData = await accountsResponse.json();

    // 6. Obtener el primer WABA disponible
    const wabaAccount = accountsData.data?.[0];

    if (!wabaAccount) {
      throw new Error('No WhatsApp Business Account found');
    }

    // 7. Obtener detalles del WABA
    const wabaDetailsResponse = await fetch(
      `https://graph.facebook.com/v23.0/${wabaAccount.id}?` +
      `fields=id,name,phone_numbers`,
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const wabaDetails = await wabaDetailsResponse.json();
    const phoneNumber = wabaDetails.phone_numbers?.[0];

    if (!phoneNumber) {
      throw new Error('No phone number associated with WABA');
    }

    // 8. Guardar tenant en base de datos
    const tenant = await createTenant({
      wabaId: wabaDetails.id,
      phoneNumberId: phoneNumber.id,
      businessName: wabaDetails.name || 'Sin nombre',
      accessToken: access_token,
      displayPhoneNumber: phoneNumber.display_phone_number,
    });

    logger.info('New tenant onboarded', {
      tenantId: tenant.id,
      businessName: tenant.businessName,
      wabaId: tenant.wabaId,
    });

    // 9. Redirigir al dashboard con éxito
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?` +
      `success=true&tenant_id=${tenant.id}`
    );

  } catch (error: any) {
    logger.error('Embedded signup failed', error);

    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?` +
      `error=signup_failed&message=${encodeURIComponent(error.message)}`
    );
  }
}
```

#### 3. Configuración en Meta App Dashboard

1. Ir a **App Dashboard** → **WhatsApp** → **Configuration**
2. Configurar **Embedded Signup**:
   - **Config Name**: `migue.ai Embedded Signup`
   - **Redirect URL**: `https://tu-dominio.com/api/auth/whatsapp/callback`
   - **Scopes**: `whatsapp_business_management`, `whatsapp_business_messaging`
3. Copiar el **Config ID** generado
4. Agregar a `.env.local`:
   ```bash
   NEXT_PUBLIC_EMBEDDED_SIGNUP_CONFIG_ID=<config_id>
   ```

---

## Validación de Firma

En un entorno multi-tenant, cada cliente puede tener diferentes configuraciones de seguridad.

### Opciones de Validación

#### Opción 1: App Secret Compartido (Más Simple)

Todos los tenants usan el mismo `APP_SECRET` de tu Meta App.

```typescript
// lib/webhook-validation.ts
export async function validateSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const [algorithm, provided] = signature.split('=');
  if (algorithm !== 'sha256') return false;

  // Usar el APP_SECRET global
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;

  const expected = await hmacSha256Hex(secret, rawBody);

  // Comparación constant-time
  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(provided)
  );
}
```

**Pros:**
- ✅ Más simple de implementar
- ✅ No requiere lookup adicional

**Cons:**
- ⚠️ Todos los tenants comparten el mismo secret
- ⚠️ Si se compromete, afecta a todos

#### Opción 2: Secret por Tenant (Más Seguro)

Cada tenant puede tener su propio `app_secret` almacenado en la base de datos.

```typescript
// lib/webhook-validation-multitenant.ts
export async function validateSignatureMultiTenant(
  req: Request,
  rawBody: string,
  tenantAppSecret: string  // ← Secret específico del tenant
): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) return false;

  const [algorithm, provided] = signature.split('=');
  if (algorithm !== 'sha256') return false;

  const expected = await hmacSha256Hex(tenantAppSecret, rawBody);

  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(provided)
  );
}

// En el webhook handler:
async function processWebhook(req: Request) {
  const rawBody = await req.text();
  const payload = JSON.parse(rawBody);

  // 1. Extraer WABA_ID primero
  const wabaId = payload.entry[0]?.id;

  // 2. Buscar tenant
  const tenant = await getTenantByWABA(wabaId);
  if (!tenant) {
    return new Response('Unknown WABA', { status: 200 });
  }

  // 3. Validar firma con el secret del tenant
  const isValid = await validateSignatureMultiTenant(
    req,
    rawBody,
    tenant.appSecret || process.env.WHATSAPP_APP_SECRET  // Fallback
  );

  if (!isValid) {
    logger.warn('Invalid signature for tenant', { tenantId: tenant.id });
    return new Response('Invalid signature', { status: 401 });
  }

  // 4. Procesar mensaje
  await processMessageForTenant(payload, tenant);

  return new Response('OK', { status: 200 });
}
```

**Pros:**
- ✅ Mayor seguridad (aislamiento)
- ✅ Rotación de secrets por tenant

**Cons:**
- ⚠️ Requiere lookup del tenant antes de validar
- ⚠️ Más complejo de gestionar

**Recomendación:** Usar **Opción 1** (shared secret) inicialmente, migrar a **Opción 2** si tienes clientes enterprise.

---

## Implementación Práctica

### Webhook Handler Multi-Tenant

```typescript
// app/api/whatsapp/webhook/route.ts
export const runtime = 'edge';

import { waitUntil } from '@vercel/functions';
import { getTenantByWABA, setTenantContext } from '@/lib/multi-tenant';
import { validateSignature, verifyToken } from '@/lib/webhook-validation';
import { logger } from '@/lib/logger';

/**
 * GET - Webhook verification (mismo para todos los tenants)
 */
export async function GET(req: Request): Promise<Response> {
  return verifyToken(req);
}

/**
 * POST - Webhook handler multi-tenant
 */
export async function POST(req: Request): Promise<Response> {
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    // 1. Validar firma (shared app secret)
    const rawBody = await req.text();
    const signatureOk = await validateSignature(req, rawBody);

    if (!signatureOk) {
      logger.warn('[webhook] Invalid signature', { requestId });
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      });
    }

    // 2. Parse JSON
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      logger.error('[webhook] JSON parse failed', parseErr, { requestId });
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // 3. Extraer WABA ID del payload
    const wabaId = payload.entry?.[0]?.id;
    const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!wabaId) {
      logger.warn('[webhook] Missing WABA ID in payload', { requestId });
      return new Response(JSON.stringify({ error: 'Missing WABA ID' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // 4. Buscar tenant en base de datos
    const tenant = await getTenantByWABA(wabaId);

    if (!tenant) {
      logger.warn('[webhook] Unknown WABA received', {
        requestId,
        wabaId: wabaId.slice(0, 8) + '***',  // Obfuscate
        phoneNumberId: phoneNumberId?.slice(0, 8) + '***'
      });

      // Siempre retornar 200 para evitar retries de WhatsApp
      return new Response(JSON.stringify({
        status: 'ignored',
        reason: 'unknown_waba'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    logger.info('[webhook] Request received for tenant', {
      requestId,
      tenantId: tenant.id,
      businessName: tenant.businessName,
      wabaId: wabaId.slice(0, 8) + '***'
    });

    // 5. Establecer contexto del tenant para RLS
    await setTenantContext(tenant.id);

    // 6. Fire-and-forget: Procesar en background
    waitUntil(
      processWebhookForTenant(requestId, payload, tenant).catch((err) => {
        logger.error('[webhook] Background processing failed', err, {
          requestId,
          tenantId: tenant.id
        });
      })
    );

    // 7. Retornar 200 OK inmediatamente
    return new Response(JSON.stringify({
      success: true,
      request_id: requestId
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    logger.error('[webhook] Webhook processing error', error, { requestId });

    // Siempre retornar 200 para evitar retry storms
    return new Response(JSON.stringify({
      success: false,
      error: 'Processing failed',
      request_id: requestId
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}

/**
 * Procesar webhook en background con contexto del tenant
 */
async function processWebhookForTenant(
  requestId: string,
  payload: any,
  tenant: Tenant
): Promise<void> {
  try {
    // Extraer mensaje
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      logger.debug('[background] No message in payload', {
        requestId,
        tenantId: tenant.id
      });
      return;
    }

    // Normalizar mensaje
    const normalized = whatsAppMessageToNormalized(message);

    // Agregar tenant_id al mensaje
    normalized.tenantId = tenant.id;

    // Persistir mensaje (con tenant_id)
    const result = await persistNormalizedMessage(normalized);

    if (!result || !result.wasInserted) {
      logger.info('[background] Duplicate message', {
        requestId,
        tenantId: tenant.id,
        waMessageId: normalized.waMessageId
      });
      return;
    }

    // Procesar con AI usando configuración del tenant
    await processMessageWithAI(
      result.conversationId,
      result.userId,
      normalized.from,
      normalized.content,
      normalized.waMessageId,
      tenant  // ← Pasar configuración del tenant
    );

    logger.info('[background] Message processed successfully', {
      requestId,
      tenantId: tenant.id,
      conversationId: result.conversationId
    });

  } catch (error: any) {
    logger.error('[background] Processing error', error, {
      requestId,
      tenantId: tenant.id
    });
  }
}
```

### Modificar AI Processing para Multi-Tenant

```typescript
// lib/ai-processing-v2.ts

export async function processMessageWithAI(
  conversationId: string,
  userId: string,
  phoneNumber: string,
  messageText: string,
  waMessageId: string | undefined,
  tenant?: Tenant  // ← Parámetro opcional del tenant
): Promise<void> {
  // Obtener configuración del tenant (si está disponible)
  const aiProvider = tenant?.settings?.aiProvider || 'gemini';  // Default: Gemini
  const systemPrompt = tenant?.settings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const model = tenant?.settings?.aiModel || 'gemini-2.5-flash';

  logger.info('Processing message with AI', {
    conversationId,
    userId,
    tenantId: tenant?.id,
    aiProvider,
    model
  });

  // Seleccionar proveedor de IA según configuración del tenant
  let aiResponse: string;

  switch (aiProvider) {
    case 'gemini':
      aiResponse = await callGemini(messageText, systemPrompt, model);
      break;

    case 'openai':
      aiResponse = await callOpenAI(messageText, systemPrompt, model);
      break;

    case 'claude':
      aiResponse = await callClaude(messageText, systemPrompt, model);
      break;

    default:
      aiResponse = await callGemini(messageText, systemPrompt, model);
  }

  // Enviar respuesta usando access_token del tenant
  await sendWhatsAppText(
    phoneNumber,
    aiResponse,
    tenant?.accessToken  // ← Usar token del tenant
  );
}
```

### Modificar WhatsApp Client para Multi-Tenant

```typescript
// lib/whatsapp.ts

/**
 * Enviar mensaje de texto (multi-tenant)
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
  accessToken?: string  // ← Token específico del tenant
): Promise<void> {
  // Usar token del tenant o el global (fallback para single-tenant)
  const token = accessToken || process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;  // O del tenant

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
  }
}
```

---

## Migración desde Single-Tenant

### Plan de Migración

```
Fase 1: Preparación (1-2 días)
├── Crear tabla tenants
├── Agregar tenant_id a tablas existentes
├── Migrar datos actuales a tenant "default"
└── Testing en development

Fase 2: Implementación (2-3 días)
├── Modificar webhook handler con routing
├── Actualizar funciones de persistencia
├── Modificar AI processing
└── Actualizar WhatsApp client

Fase 3: Embedded Signup (1-2 días)
├── Implementar OAuth flow
├── Crear UI de onboarding
├── Testing con cuenta real
└── Configurar en Meta App Dashboard

Fase 4: Testing & Deploy (1-2 días)
├── Testing end-to-end multi-tenant
├── Migración de producción
├── Monitoreo intensivo
└── Rollback plan listo
```

### Script de Migración

```sql
-- 1. Crear tenant "default" para datos existentes
INSERT INTO tenants (
  waba_id,
  phone_number_id,
  business_name,
  access_token,
  status,
  plan_type
) VALUES (
  'default_waba',
  current_setting('app.whatsapp_phone_id'),
  'migue.ai Original',
  current_setting('app.whatsapp_token'),
  'active',
  'enterprise'
) RETURNING id;

-- 2. Guardar el ID del tenant default
-- Asumiendo que retornó: '550e8400-e29b-41d4-a716-446655440000'

-- 3. Migrar todos los users al tenant default
UPDATE users
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 4. Migrar todas las conversations
UPDATE conversations_v2
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 5. Migrar todos los messages
UPDATE messages_v2
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 6. Migrar reminders
UPDATE reminders
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 7. Migrar meetings
UPDATE meetings
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 8. Migrar expenses
UPDATE expenses
SET tenant_id = '550e8400-e29b-41d4-a716-446655440000'
WHERE tenant_id IS NULL;

-- 9. Hacer tenant_id NOT NULL (después de migración)
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE conversations_v2 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE messages_v2 ALTER COLUMN tenant_id SET NOT NULL;

-- 10. Verificar migración
SELECT
  'users' AS table_name,
  COUNT(*) AS total,
  COUNT(DISTINCT tenant_id) AS unique_tenants
FROM users
UNION ALL
SELECT
  'conversations',
  COUNT(*),
  COUNT(DISTINCT tenant_id)
FROM conversations_v2
UNION ALL
SELECT
  'messages',
  COUNT(*),
  COUNT(DISTINCT tenant_id)
FROM messages_v2;
```

---

## Comparación de Costos

### Single-Tenant (Actual)

```
Infraestructura:
├── Vercel Pro: $20/mes
├── Supabase Pro: $25/mes
├── WhatsApp (1 número): Variable
└── AI (Gemini Free): $0/mes

TOTAL por cliente: ~$45/mes
Con 10 clientes: $450/mes (10 instancias separadas)
```

### Multi-Tenant

```
Infraestructura compartida:
├── Vercel Pro: $20/mes
├── Supabase Pro: $25/mes (escala mejor)
├── WhatsApp (N números): Variable por cliente
└── AI (Gemini Free): $0/mes (hasta 1,500 req/día TOTAL)

TOTAL base: $45/mes
Costo marginal por cliente adicional: ~$0/mes
Con 10 clientes: $45/mes + costos WhatsApp individuales

AHORRO: ~$405/mes (90%) en infraestructura
```

### Escalabilidad

| Métrica | Single-Tenant | Multi-Tenant |
|---------|---------------|--------------|
| **Clientes soportados** | 1 | Ilimitado |
| **Costo por cliente** | $45 | ~$5 (marginal) |
| **Tiempo de onboarding** | 1-2 días (manual) | <5 minutos (auto) |
| **Mantenimiento** | N × esfuerzo | 1 × esfuerzo |
| **Escalamiento** | Lineal | Logarítmico |

---

## Limitaciones y Consideraciones

### Limitaciones de WhatsApp Business API

1. **Rate Limits**:
   - 250 mensajes/segundo por WABA
   - Compartido entre todos los números del WABA
   - Implementar queue con throttling

2. **Verificación de Negocio**:
   - Requerida después de 2 números por WABA
   - Proceso puede tomar días
   - Planificar con anticipación

3. **Quality Rating**:
   - Cada WABA tiene su propio quality rating (GREEN, YELLOW, RED)
   - Un tenant con mal rating no afecta a otros
   - Monitoring independiente

4. **Messaging Limits**:
   - Inician en TIER_50 (50 conversaciones/día)
   - Escalan a TIER_250, TIER_1K, TIER_10K, UNLIMITED
   - Por WABA, no por app

### Limitaciones de Gemini Free Tier

```
Gemini 2.5 Flash - FREE:
├── 1,500 requests/día (compartidos entre TODOS los tenants)
├── 1M tokens context window
└── Rate limit: 15 RPM (requests per minute)

Implicaciones:
- Con 10 tenants activos = 150 requests/día por tenant
- Monitorear uso total en tiempo real
- Implementar fallback a GPT-4o-mini si se excede
- Considerar Gemini Paid si creces más
```

### Consideraciones de Seguridad

1. **Row Level Security (RLS)**:
   - ✅ Implementar en TODAS las tablas
   - ✅ Testing exhaustivo de aislamiento
   - ✅ Auditoría de accesos cross-tenant

2. **Token Management**:
   - ❌ NUNCA exponer access_tokens en frontend
   - ✅ Encriptar tokens en base de datos
   - ✅ Rotación periódica de tokens

3. **Validación de Entrada**:
   - ✅ Validar WABA_ID en cada request
   - ✅ Prevenir tenant enumeration
   - ✅ Rate limiting por tenant

### Monitoreo y Observabilidad

```typescript
// lib/tenant-metrics.ts

export async function trackTenantUsage(
  tenantId: string,
  metrics: {
    messagesSent: number;
    messagesReceived: number;
    aiRequests: number;
    tokensUsed: number;
  }
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_tenant_usage', {
    p_tenant_id: tenantId,
    p_period_start: today,
    p_messages_sent: metrics.messagesSent,
    p_messages_received: metrics.messagesReceived,
    p_ai_requests: metrics.aiRequests,
    p_tokens_used: metrics.tokensUsed
  });
}

// Dashboard query
export async function getTenantMetrics(tenantId: string) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tenant_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  return data;
}
```

---

## Próximos Pasos

### Implementación Inmediata

1. ✅ Leer esta documentación completamente
2. ✅ Crear tabla `tenants` en Supabase
3. ✅ Modificar webhook handler con routing
4. ✅ Testing en desarrollo con 2 tenants simulados

### Implementación a Mediano Plazo

1. Configurar Embedded Signup en Meta App Dashboard
2. Implementar OAuth callback
3. Crear UI de onboarding
4. Migrar datos actuales a tenant "default"

### Implementación a Largo Plazo

1. Dashboard multi-tenant
2. Billing por tenant
3. Analytics por tenant
4. White-label customization
5. API pública para partners

---

## Recursos Adicionales

### Documentación Oficial

- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)
- [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Solution Providers](https://developers.facebook.com/docs/whatsapp/solution-providers)
- [Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

### Documentación migue.ai

- [WhatsApp API v23 Guide](./api-v23-guide.md)
- [Webhook Specification](../../reference/whatsapp-webhook-spec.md)
- [Database Schema](../../reference/supabase-schema.md)
- [Architecture Overview](../../architecture/overview.md)

---

**Última actualización**: 2025-10-10
**Versión**: 1.0
**Autor**: claude-master
**Estado**: Completo - Listo para implementación
