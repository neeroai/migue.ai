# Guía Completa: Configurar App de Meta para migue.ai

**Guía paso a paso para aprobar tu WhatsApp Business API app en Meta - Actualizado 2025**

---

## Tabla de Contenidos

- [Introducción](#introducción)
- [Timeline Estimado](#timeline-estimado)
- [Prerequisitos](#prerequisitos)
- [Fase 1: Meta Business Manager Setup](#fase-1-meta-business-manager-setup)
- [Fase 2: Business Verification](#fase-2-business-verification)
- [Fase 3: App Configuration](#fase-3-app-configuration)
- [Fase 4: Testing Environment](#fase-4-testing-environment)
- [Fase 5: App Review Submission](#fase-5-app-review-submission)
- [Fase 6: Production Deployment](#fase-6-production-deployment)
- [Legal Requirements](#legal-requirements)
- [Checklist Completo](#checklist-completo)
- [Troubleshooting](#troubleshooting)
- [Recursos Adicionales](#recursos-adicionales)

---

## Introducción

Esta guía te ayudará a configurar una app de Meta para **migue.ai** y obtener aprobación para usar WhatsApp Business API.

### ¿Por qué necesitas esto?

Para usar WhatsApp Business API de forma independiente (sin BSP), Meta requiere:
1. ✅ Business verificado
2. ✅ App de Facebook configurada
3. ✅ Permisos aprobados vía App Review
4. ✅ Cumplimiento de políticas

### Lo que lograrás

Al completar esta guía tendrás:
- ✅ WhatsApp Business Account (WABA) verificado
- ✅ App de Meta aprobada para producción
- ✅ Webhook configurado y funcionando
- ✅ Templates aprobados para enviar mensajes
- ✅ Límites de mensajería escalados

---

## Timeline Estimado

| Fase | Duración | Dependencias |
|------|----------|--------------|
| **Business Manager Setup** | 10 minutos | Ninguna |
| **Business Verification** | 1-7 días | Documentos legales |
| **App Configuration** | 30 minutos | Business verificado |
| **Testing Environment** | 1-2 horas | App configurada |
| **App Review Submission** | 2-3 horas | Screencast grabado |
| **App Review Approval** | 2-7 días | Submission completo |
| **Production Deployment** | 1 hora | Aprobación recibida |

**Total**: 5-15 días (la mayoría es tiempo de espera de Meta)

---

## Prerequisitos

### Documentos Legales Requeridos

Meta requiere **2 documentos** para verificar tu negocio:

#### 1. Business Legal Name Document

Uno de los siguientes:
- ✅ Certificado de incorporación
- ✅ Registro mercantil
- ✅ Tax ID / NIT / RUT
- ✅ Licencia de negocio

**Requisitos**:
- Debe mostrar el nombre legal del negocio
- Debe estar vigente (no expirado)
- Debe ser legible (PDF o foto clara)
- Idioma: Español o Inglés

#### 2. Business Address & Phone Number Document

Uno de los siguientes:
- ✅ Factura de servicios (luz, agua, internet)
- ✅ Estado de cuenta bancario
- ✅ Contrato de arrendamiento

**Requisitos**:
- Debe mostrar dirección física del negocio
- Debe tener fecha reciente (últimos 3 meses)
- Debe coincidir con la dirección en Business Manager

### Requisitos Técnicos

#### Website Requerido

**IMPORTANTE**: Meta NO aprueba negocios sin website.

Tu website debe tener:
- ✅ Dominio propio (migue.ai ✅)
- ✅ HTTPS activo
- ✅ Privacy Policy visible
- ✅ Terms of Service (opcional pero recomendado)
- ✅ Contact information (email, teléfono)
- ✅ About page describiendo el negocio

#### Número de Teléfono

**Requisitos del número para WhatsApp**:
- ✅ NO puede estar registrado en WhatsApp personal
- ✅ NO puede estar registrado en WhatsApp Business App
- ✅ Debe poder recibir SMS o llamadas de voz
- ✅ Formato E.164 (ej: +573001234567)

**Opciones**:
- Número móvil nuevo
- Número fijo (landline)
- Número VoIP (Twilio, etc.)

#### Email de Negocio

**Recomendado**: Usa email del dominio de tu negocio
- ✅ Bueno: contacto@migue.ai
- ❌ Evita: migueai@gmail.com

Esto aumenta credibilidad ante Meta.

### Accesos Necesarios

- ✅ Cuenta de Facebook personal (administrador)
- ✅ Acceso a la documentación legal del negocio
- ✅ Acceso al dominio del website (para verificaciones)

---

## Fase 1: Meta Business Manager Setup

**Duración**: 10 minutos
**Requisitos**: Cuenta de Facebook

### Paso 1.1: Crear Meta Business Manager

1. Ve a [business.facebook.com](https://business.facebook.com)
2. Haz clic en **"Create Account"**
3. Completa la información:
   ```
   Business name: migue.ai
   Your name: [Tu nombre]
   Business email: contacto@migue.ai
   ```
4. Haz clic en **"Submit"**

### Paso 1.2: Configurar Business Details

1. En Business Settings, ve a **Business Info**
2. Completa todos los campos:

```yaml
Legal Business Name: migue.ai SAS  # Debe coincidir con documentos
Business Address:
  - Street: [Dirección física]
  - City: [Ciudad]
  - State: [Departamento]
  - Postal Code: [Código postal]
  - Country: Colombia

Phone Number: +57 300 123 4567  # Número principal del negocio
Website: https://migue.ai
Business Email: contacto@migue.ai

Tax ID: [NIT de la empresa]
Business Type: Technology Company
Industry: Computer Software
```

3. Guarda los cambios

### Paso 1.3: Agregar Usuarios (Opcional)

Si tienes un equipo:

1. Ve a **Users** → **People**
2. Haz clic en **Add**
3. Ingresa email y selecciona rol:
   - **Admin Access**: Control total
   - **Employee Access**: Acceso limitado

---

## Fase 2: Business Verification

**Duración**: 1-7 días (tiempo de revisión de Meta)
**Requisitos**: Documentos legales preparados

### Paso 2.1: Iniciar Verificación

1. En Business Settings, ve a **Security Center**
2. Haz clic en **Start Verification**
3. Selecciona método de verificación:
   - ✅ **Document Verification** (recomendado - más rápido)
   - Phone Verification (requiere llamada)

### Paso 2.2: Subir Documentos

#### Documento 1: Business Legal Name

1. Selecciona tipo de documento:
   ```
   ☐ Articles of Incorporation (Certificado de incorporación)
   ☐ Business License (Licencia de negocio)
   ☑ Tax Document (Documento fiscal - NIT/RUT)
   ☐ Other
   ```

2. Sube el archivo:
   - Formato: PDF, JPG, PNG
   - Tamaño máximo: 8 MB
   - Resolución mínima: 150 DPI

#### Documento 2: Business Address

1. Selecciona tipo de documento:
   ```
   ☑ Utility Bill (Factura de servicios)
   ☐ Bank Statement (Estado de cuenta)
   ☐ Lease Agreement (Contrato de arrendamiento)
   ```

2. Requisitos:
   - Debe mostrar dirección completa
   - Fecha reciente (últimos 3 meses)
   - Nombre del negocio visible

### Paso 2.3: Verificación de Teléfono

1. Ingresa número de teléfono del negocio
2. Selecciona método:
   - ✅ SMS
   - Llamada de voz

3. Ingresa código de 6 dígitos recibido

### Paso 2.4: Esperar Revisión

**Timeline**:
- ⚡ Fast track: 1-2 días (90% de casos)
- 🐢 Revisión adicional: 3-7 días

**Seguimiento**:
- Recibirás notificación por email
- También visible en Security Center

### Razones Comunes de Rechazo

❌ **Documentos ilegibles**
- Solución: Usa PDF de alta calidad o foto clara

❌ **Nombre no coincide**
- Solución: Asegúrate que nombre legal en documentos = nombre en Business Manager

❌ **Dirección no coincide**
- Solución: Verifica que dirección sea exactamente igual

❌ **Documentos expirados**
- Solución: Usa documentos vigentes

❌ **Website inactivo o sin info**
- Solución: Asegúrate que migue.ai tenga Privacy Policy visible

### Qué Hacer Si Te Rechazan

1. Revisa el email de rechazo - Meta explica el motivo
2. Corrige el problema identificado
3. Vuelve a **Security Center** → **Start Verification**
4. Sube documentos corregidos

**Pro tip**: Toma capturas de pantalla de tus documentos antes de subirlos para referencia futura.

---

## Fase 3: App Configuration

**Duración**: 30 minutos
**Requisitos**: Business verificado ✅

### Paso 3.1: Crear Facebook App

1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Haz clic en **Create App**
3. Selecciona tipo:
   ```
   ☑ Business
   ☐ Consumer
   ☐ Gaming
   ```
4. Completa información:
   ```yaml
   App Name: migue.ai WhatsApp Bot
   App Contact Email: contacto@migue.ai
   Business Account: [Selecciona tu Business Manager]
   ```
5. Haz clic en **Create App**

### Paso 3.2: Agregar WhatsApp Product

1. En App Dashboard, busca **WhatsApp** en productos
2. Haz clic en **Set Up**
3. Selecciona o crea Business Portfolio:
   ```
   ☑ Create new business portfolio
   Portfolio name: migue.ai
   ```
4. Haz clic en **Continue**

### Paso 3.3: Crear WhatsApp Business Account (WABA)

Meta te guiará por el proceso:

1. **Business Info**:
   ```yaml
   Business Name: migue.ai
   Business Category: Technology
   Business Description: Asistente de IA para agendamiento de citas
   Business Website: https://migue.ai
   ```

2. **Business Address** (debe coincidir con Business Manager):
   ```
   [Usar misma dirección de Fase 1.2]
   ```

3. **Contact Information**:
   ```yaml
   Name: [Tu nombre]
   Email: contacto@migue.ai
   Phone: +57 300 123 4567
   ```

4. Acepta **WhatsApp Business Terms**

### Paso 3.4: Agregar Número de Teléfono

#### Opción A: Número Nuevo (Recomendado)

1. Haz clic en **Add phone number**
2. Selecciona país: **Colombia (+57)**
3. Ingresa número: `300 123 4567`
4. Selecciona método de verificación:
   - ✅ SMS
   - Voice call

5. Ingresa código de 6 dígitos
6. El número ahora está vinculado a tu WABA ✅

#### Opción B: Migrar Número Existente

Si ya tienes un número en WhatsApp Business App:

1. Haz clic en **Migrate existing number**
2. Sigue las instrucciones para migrar
3. **ADVERTENCIA**: Perderás el historial de chats

### Paso 3.5: Configurar Permisos de App

1. Ve a **App Settings** → **Basic**
2. Completa información:

```yaml
Display Name: migue.ai
App Domains: migue.ai
Privacy Policy URL: https://migue.ai/privacy
Terms of Service URL: https://migue.ai/terms (opcional)
App Icon: [Sube logo de migue.ai - 1024x1024px]
Category: Business Tools
```

3. Guarda cambios

### Paso 3.6: Obtener Credenciales

#### System User Access Token (Recomendado para Producción)

1. Ve a Business Settings → **Users** → **System Users**
2. Haz clic en **Add**
3. Crea system user:
   ```
   Name: migue.ai System User
   Role: Admin
   ```
4. Haz clic en **Generate New Token**
5. Selecciona permisos:
   ```
   ☑ whatsapp_business_management
   ☑ whatsapp_business_messaging
   ```
6. Copia el token y guárdalo en `.env.local`:
   ```bash
   WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxx
   ```

#### Obtener Phone Number ID

1. Ve a App Dashboard → **WhatsApp** → **API Setup**
2. Copia el **Phone Number ID**:
   ```bash
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   ```

#### Obtener WABA ID

1. En API Setup, copia **WhatsApp Business Account ID**:
   ```bash
   WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
   ```

### Paso 3.7: Configurar Webhook

1. En App Dashboard, ve a **WhatsApp** → **Configuration**
2. Haz clic en **Edit** en Webhook section
3. Configura webhook:

```yaml
Callback URL: https://migue.ai/api/whatsapp/webhook
Verify Token: [Genera token aleatorio seguro]
```

**Generar Verify Token**:
```bash
# En tu terminal
openssl rand -hex 32
# Resultado: 3f8a9b2c...
```

Guarda en `.env.local`:
```bash
WHATSAPP_VERIFY_TOKEN=3f8a9b2c...
```

4. Haz clic en **Verify and Save**

Meta enviará GET request a tu webhook para verificar.

5. Suscribe a eventos:
   ```
   ☑ messages
   ☐ message_template_status_update (opcional)
   ☐ messaging_handovers (opcional)
   ```

### Paso 3.8: Obtener App Secret

1. Ve a **App Settings** → **Basic**
2. Haz clic en **Show** en App Secret
3. Copia y guarda:
   ```bash
   WHATSAPP_APP_SECRET=abc123...
   ```

**IMPORTANTE**: Usa este secret para validar firmas de webhook.

---

## Fase 4: Testing Environment

**Duración**: 1-2 horas
**Requisitos**: App configurada, webhook desplegado

### Paso 4.1: Verificar Webhook Local

Antes de probar con WhatsApp, verifica que tu webhook funcione:

#### Test GET (Verificación)

```bash
curl "https://migue.ai/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=test123"

# Respuesta esperada:
test123
```

#### Test POST (Mensaje de prueba)

```bash
# 1. Genera firma HMAC
PAYLOAD='{"entry":[{"changes":[{"value":{"messages":[{"from":"573001234567","id":"test","timestamp":"1234567890","type":"text","text":{"body":"Hola"}}]}}]}]}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "TU_APP_SECRET" | cut -d' ' -f2)

# 2. Envía request
curl -X POST https://migue.ai/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"

# Respuesta esperada:
{"success":true,"request_id":"..."}
```

### Paso 4.2: Configurar Test Numbers

Meta proporciona un número de prueba automáticamente.

#### Agregar Números de Prueba

1. Ve a App Dashboard → **WhatsApp** → **API Setup**
2. En sección **To**, haz clic en **Manage phone number list**
3. Agrega tu número personal de WhatsApp:
   ```
   +57 300 987 6543
   ```
4. WhatsApp te enviará código de verificación
5. Ingresa el código en Meta dashboard

Puedes agregar hasta **5 números de prueba**.

### Paso 4.3: Enviar Mensaje de Prueba (Template)

Meta crea automáticamente un template "hello_world":

#### Desde API Setup UI

1. Ve a **WhatsApp** → **API Setup**
2. Selecciona:
   - **From**: Tu número de negocio
   - **To**: Tu número de prueba
   - **Message**: Hello World template

3. Haz clic en **Send message**

#### Desde cURL

```bash
curl -X POST \
  "https://graph.facebook.com/v23.0/TU_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "573009876543",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": {
        "code": "en_US"
      }
    }
  }'
```

**Respuesta esperada**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "573009876543",
    "wa_id": "573009876543"
  }],
  "messages": [{
    "id": "wamid.HBgNNTczMDA5ODc2NTQzFQIAERgRMTIzNDU2Nzg5MDEyMzQ1AA=="
  }]
}
```

### Paso 4.4: Recibir Mensaje de Prueba

1. Desde tu WhatsApp personal, responde al mensaje del bot
2. Tu webhook debería recibir el mensaje
3. Verifica en logs de Vercel:

```bash
vercel logs --follow
```

**Payload esperado en webhook**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "TU_WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "TU_PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": {
            "name": "Tu Nombre"
          },
          "wa_id": "573009876543"
        }],
        "messages": [{
          "from": "573009876543",
          "id": "wamid.ABC123==",
          "timestamp": "1234567890",
          "type": "text",
          "text": {
            "body": "Mensaje de prueba"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

### Paso 4.5: Crear Template Personalizado

Los templates deben ser aprobados por Meta antes de usarse.

#### Crear Template en Meta Dashboard

1. Ve a **WhatsApp** → **Message Templates**
2. Haz clic en **Create Template**
3. Completa información:

```yaml
Template Name: bienvenida_migue
Category: UTILITY  # Gratis
Language: Spanish (es)

Header: None

Body: |
  Hola {{1}}, bienvenido a migue.ai! 👋

  Soy tu asistente virtual. Puedo ayudarte a:
  • Agendar citas
  • Recordarte tus compromisos
  • Gestionar tu calendario

  ¿En qué puedo ayudarte hoy?

Footer: Powered by migue.ai

Buttons: None
```

4. Variables en el mensaje:
   - `{{1}}` = Nombre del usuario (pasarás dinámicamente)

5. Haz clic en **Submit**

#### Tiempo de Aprobación

- ⚡ Templates UTILITY: 1-24 horas
- 🐢 Templates MARKETING: 24-48 horas

#### Usar Template Aprobado

```typescript
// lib/whatsapp.ts
export async function sendWelcomeTemplate(
  phoneNumber: string,
  userName: string
): Promise<void> {
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: 'bienvenida_migue',
      language: {
        code: 'es'
      },
      components: [{
        type: 'body',
        parameters: [{
          type: 'text',
          text: userName
        }]
      }]
    }
  };

  await sendWhatsAppRequest(payload);
}
```

### Paso 4.6: Testing Checklist

Antes de continuar a App Review, verifica:

- [ ] Webhook recibe mensajes de prueba
- [ ] Webhook valida firma HMAC correctamente
- [ ] Bot responde a mensajes de texto
- [ ] Template "hello_world" se envía correctamente
- [ ] Template personalizado aprobado y funciona
- [ ] Mensajes se persisten en base de datos
- [ ] Errores se loguean correctamente
- [ ] Rate limiting funciona (si aplica)
- [ ] Typing indicators funcionan
- [ ] Read receipts funcionan

---

## Fase 5: App Review Submission

**Duración**: 2-3 horas (preparación) + 2-7 días (revisión)
**Requisitos**: Testing completado ✅

### Paso 5.1: Entender App Review

Meta requiere **App Review** para dar acceso a permisos avanzados.

#### Permisos Requeridos

```yaml
whatsapp_business_messaging:
  - Enviar mensajes a usuarios
  - Recibir mensajes de usuarios
  - Gestionar conversaciones

whatsapp_business_management:
  - Crear templates de mensajes
  - Gestionar configuración de WABA
  - Ver analíticas
```

#### Qué Evalúa Meta

1. ✅ **Funcionalidad**: Tu app hace lo que dices
2. ✅ **Compliance**: Cumples políticas de WhatsApp
3. ✅ **User Experience**: Buena experiencia para usuarios
4. ✅ **Privacy**: Manejas datos responsablemente

### Paso 5.2: Preparar Use Case Description

Meta requiere que expliques **cómo usarás los permisos**.

#### Template de Use Case

```markdown
## App Name
migue.ai WhatsApp Assistant

## Business Description
migue.ai es un asistente virtual de IA que ayuda a profesionales y pequeños negocios a gestionar sus agendas y recordatorios a través de WhatsApp.

## How You'll Use whatsapp_business_messaging

Nuestra app usará este permiso para:

1. **Recibir mensajes de usuarios**:
   - Los usuarios envían solicitudes en lenguaje natural (ej: "Recuérdame mañana a las 3pm llamar al doctor")
   - Nuestra IA procesa el mensaje y extrae la intención

2. **Enviar respuestas conversacionales**:
   - Confirmaciones de tareas creadas
   - Recordatorios programados
   - Respuestas a consultas sobre citas agendadas

3. **Enviar notificaciones útiles**:
   - Recordatorios de citas (con opt-in previo)
   - Confirmaciones de agendamiento
   - Resúmenes diarios de tareas pendientes

## How You'll Use whatsapp_business_management

Nuestra app usará este permiso para:

1. **Crear templates de mensajes**:
   - Templates de bienvenida
   - Templates de recordatorios
   - Templates de confirmación de citas

2. **Gestionar configuración**:
   - Actualizar business profile
   - Monitorear métricas de mensajería
   - Gestionar display name

## User Opt-In Process

Los usuarios optan por recibir mensajes de nuestra app mediante:

1. Registro en nuestro website (https://migue.ai)
2. Aceptación explícita de términos
3. Envío voluntario del primer mensaje al bot
4. Opción de opt-out en cualquier momento escribiendo "STOP"

## Data Privacy

- Encriptamos todos los datos de usuarios
- No compartimos información con terceros
- Cumplimos con GDPR y políticas de WhatsApp
- Privacy Policy: https://migue.ai/privacy
```

### Paso 5.3: Crear Screencasts

**CRÍTICO**: Meta rechaza la mayoría de submissions por screencasts inadecuados.

#### Requisitos Generales de Screencasts

✅ **Debe Incluir**:
- Flujo completo de uso del permiso
- Interfaz de tu app claramente visible
- WhatsApp recibiendo/enviando mensajes
- Transiciones fluidas entre pantallas

❌ **NO Incluir**:
- Audio (Meta no lo escucha)
- Música de fondo
- Información personal/sensible
- Datos reales de usuarios

#### Screencast 1: whatsapp_business_messaging

**Objetivo**: Demostrar cómo tu app envía y recibe mensajes.

**Guion** (60-90 segundos):

```
1. [0-10s] Mostrar dashboard de migue.ai
   - Título visible: "migue.ai Dashboard"
   - Panel de conversaciones activas

2. [10-25s] Usuario envía mensaje desde WhatsApp
   - Abrir WhatsApp (web o móvil)
   - Enviar: "Recuérdame mañana a las 3pm reunión con Juan"
   - Mostrar mensaje enviado

3. [25-40s] Mensaje llega a tu app
   - Volver a dashboard de migue.ai
   - Mensaje aparece en interfaz
   - Mostrar procesamiento de IA (opcional)

4. [40-55s] App envía respuesta
   - Mostrar interfaz de "Send Message"
   - Respuesta: "✅ Listo! Te recordaré mañana a las 3pm sobre tu reunión con Juan"
   - Hacer clic en "Send"

5. [55-75s] Respuesta llega a WhatsApp
   - Volver a WhatsApp
   - Mensaje del bot aparece
   - Mostrar mensaje recibido

6. [75-90s] Confirmación final
   - Mostrar conversación completa
   - Fin del screencast
```

**Herramientas Recomendadas**:
- macOS: QuickTime (Cmd+Shift+5)
- Windows: Xbox Game Bar (Win+G)
- Online: Loom, OBS Studio

**Configuración**:
```yaml
Resolution: 1280x720 (mínimo)
Format: MP4, MOV, WebM
Max Size: 100 MB
Max Duration: 2 minutos
Frame Rate: 30 fps mínimo
```

#### Screencast 2: whatsapp_business_management

**Objetivo**: Demostrar creación de template de mensaje.

**Guion** (45-60 segundos):

```
1. [0-10s] Abrir Meta Business Manager
   - Navegar a WhatsApp > Message Templates

2. [10-30s] Crear nuevo template
   - Clic en "Create Template"
   - Llenar formulario:
     * Name: confirmacion_cita
     * Category: UTILITY
     * Language: Spanish
     * Body: "Tu cita con {{1}} está confirmada para {{2}}"
   - Mostrar preview

3. [30-45s] Enviar para aprobación
   - Clic en "Submit"
   - Mostrar confirmación de envío

4. [45-60s] Resultado
   - Mostrar pantalla de "Pending Approval"
   - Fin del screencast
```

#### Best Practices para Screencasts

1. **Usa Cuenta de Prueba**:
   - NO uses datos reales
   - Crea cuentas demo: demo@migue.ai

2. **Graba en Inglés (UI)**:
   - Reviewers de Meta hablan inglés
   - Si tu app está en español, agrega subtítulos en inglés

3. **Velocidad Normal**:
   - No aceleres el video
   - Muestra cada paso claramente

4. **Sin Cortes Bruscos**:
   - Transiciones suaves
   - Si necesitas cortar, usa fade

5. **Resolución Clara**:
   - Texto legible
   - Botones claramente visibles

6. **Cierra Tabs Innecesarios**:
   - Solo muestra lo relevante
   - Cierra notificaciones

### Paso 5.4: Enviar App Review

1. Ve a App Dashboard → **App Review** → **Permissions and Features**
2. Busca los permisos:
   ```
   whatsapp_business_messaging
   whatsapp_business_management
   ```

3. Para cada permiso, haz clic en **Request Advanced Access**

#### whatsapp_business_messaging

Completa el formulario:

```yaml
How will your app use this permission?:
  [Pega tu use case description de Paso 5.2]

Tell us how a person will use this feature:
  Los usuarios enviarán mensajes a nuestro bot de WhatsApp para crear recordatorios,
  agendar citas y consultar su calendario. El bot responderá automáticamente
  con confirmaciones y recordatorios programados.

Platform where this feature is used:
  ☑ Website
  ☐ Android App
  ☐ iOS App

Website URL (if applicable):
  https://migue.ai

Screencast URL:
  [Sube a Google Drive/Dropbox y pega link público]
  https://drive.google.com/file/d/abc123.../view?usp=sharing

Additional Notes (optional):
  Nuestro bot está diseñado para ayudar a profesionales a gestionar su tiempo
  de forma más eficiente mediante WhatsApp. Cumplimos con todas las políticas
  de mensajería de WhatsApp y respetamos el opt-in de usuarios.
```

#### whatsapp_business_management

Completa el formulario:

```yaml
How will your app use this permission?:
  Este permiso nos permite crear y gestionar templates de mensajes que usamos
  para enviar notificaciones útiles a nuestros usuarios, como recordatorios
  de citas y confirmaciones de agendamiento.

Tell us how a person will use this feature:
  Los administradores de negocios crearán templates personalizados desde
  nuestro dashboard para comunicarse con sus clientes de forma efectiva
  y cumpliendo con las políticas de WhatsApp.

Platform where this feature is used:
  ☑ Website
  ☐ Android App
  ☐ iOS App

Website URL (if applicable):
  https://migue.ai

Screencast URL:
  [Sube screencast de template creation]
  https://drive.google.com/file/d/xyz789.../view?usp=sharing

Additional Notes (optional):
  Solo creamos templates de categoría UTILITY y TRANSACTIONAL para
  enviar información útil y solicitada por los usuarios.
```

5. Haz clic en **Submit** para ambos permisos

### Paso 5.5: Esperar Revisión

**Timeline**:
- ⚡ Aprobación rápida: 2-3 días
- 🐢 Revisión adicional: 5-7 días

**Seguimiento**:
- Recibirás email de Meta
- También visible en App Review section

### Razones Comunes de Rechazo

#### 1. Screencast Incompleto

❌ **Error**: Screencast no muestra el flujo completo
✅ **Solución**: Asegúrate de mostrar:
- Tu app enviando mensaje
- WhatsApp recibiendo mensaje
- Usuario respondiendo
- Tu app procesando respuesta

#### 2. Use Case Poco Claro

❌ **Error**: "Your explanation doesn't clearly describe how you'll use this permission"
✅ **Solución**: Sé específico:
- Mal: "We'll use this to send messages"
- Bien: "We'll use this to send appointment reminders to users who have opted in via our website"

#### 3. Funcionalidad No Mostrada

❌ **Error**: "The functionality described is not shown in the screencast"
✅ **Solución**: Si dices que creas recordatorios, MUESTRA la creación de un recordatorio en el video

#### 4. Violación de Políticas

❌ **Error**: "Your use case violates WhatsApp Business Messaging Policy"
✅ **Solución**: Revisa [WhatsApp Business Policy](https://business.whatsapp.com/policy) y asegúrate de:
- Tener opt-in claro
- No enviar spam
- Respetar opt-out
- No pedir información sensible

### Qué Hacer Si Te Rechazan

1. **Lee el Feedback de Meta**:
   - Email explica el motivo
   - Identifica el problema específico

2. **Corrige el Issue**:
   - Re-graba screencast si es necesario
   - Mejora la descripción del use case
   - Asegúrate de cumplir políticas

3. **Re-envía**:
   - Puedes re-enviar inmediatamente
   - Meta revisará la nueva submission

4. **Contacta Support** (si es necesario):
   - business.facebook.com/support
   - Opción "App Review"

---

## Fase 6: Production Deployment

**Duración**: 1-2 horas
**Requisitos**: App Review aprobado ✅

### Paso 6.1: Verificar Aprobación

Una vez aprobado, verás:

1. Email de Meta:
   ```
   Subject: Your app's access to whatsapp_business_messaging has been approved

   Congratulations! Your app now has access to whatsapp_business_messaging.
   ```

2. En App Dashboard:
   ```
   whatsapp_business_messaging: ✅ Approved (Advanced Access)
   whatsapp_business_management: ✅ Approved (Advanced Access)
   ```

### Paso 6.2: Display Name Approval

El **Display Name** es el nombre que usuarios ven en WhatsApp.

#### Por qué es Importante

```
Antes de aprobación:
  De: +57 300 123 4567

Después de aprobación:
  De: migue.ai ✅
```

#### Solicitar Aprobación

1. Ve a **WhatsApp** → **Phone Numbers**
2. Haz clic en tu número
3. En **Display Name**, ingresa:
   ```
   migue.ai
   ```

4. Haz clic en **Request Review**

**Requisitos**:
- Debe ser el nombre de tu negocio
- No puede ser genérico (ej: "Bot", "Assistant")
- No puede incluir emojis
- Máximo 20 caracteres

**Timeline**: 1-3 días

### Paso 6.3: Escalamiento de Rate Limits

Por defecto, tu número tiene límites bajos:

```
TIER_50: 50 conversaciones únicas / 24 horas
```

#### Cómo Escalar

Meta escala automáticamente basado en:
- ✅ Quality rating (GREEN)
- ✅ Phone number status (CONNECTED)
- ✅ Volumen de mensajes

**Tiers Disponibles**:
```
TIER_50      → 50 conversaciones/día    (inicial)
TIER_250     → 250 conversaciones/día   (después de ~7 días)
TIER_1K      → 1,000 conversaciones/día (después de ~30 días)
TIER_10K     → 10,000 conversaciones/día
TIER_100K    → 100,000 conversaciones/día
TIER_UNLIMITED → Ilimitado
```

#### Verificar tu Tier Actual

```bash
curl -X GET \
  "https://graph.facebook.com/v23.0/TU_PHONE_NUMBER_ID?fields=quality_rating,messaging_limit_tier" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Respuesta**:
```json
{
  "quality_rating": "GREEN",
  "messaging_limit_tier": "TIER_50",
  "id": "123456789012345"
}
```

### Paso 6.4: Configurar Two-Step Verification

**IMPORTANTE**: Protege tu número de WhatsApp.

1. Ve a **WhatsApp** → **Phone Numbers**
2. Haz clic en tu número
3. Haz clic en **Two-step verification**
4. Ingresa PIN de 6 dígitos
5. Confirma el PIN
6. Ingresa email de recuperación

**Guarda el PIN** en tu password manager.

### Paso 6.5: Actualizar Environment Variables

Asegúrate que tu producción tenga las variables correctas:

```bash
# .env.production
WHATSAPP_TOKEN=EAA...                    # System User Token (NO User Token)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_VERIFY_TOKEN=3f8a9b2c...
WHATSAPP_APP_SECRET=abc123...

# Vercel
NEXT_PUBLIC_APP_URL=https://migue.ai
```

#### Deploy a Vercel

```bash
# Actualizar variables
vercel env add WHATSAPP_TOKEN production
vercel env add WHATSAPP_PHONE_NUMBER_ID production
# ... resto de variables

# Deploy
git push origin main  # Auto-deploy
```

### Paso 6.6: Monitoreo Post-Launch

#### Métricas Clave a Monitorear

1. **Quality Rating**:
   ```bash
   # Verificar diariamente
   curl -X GET \
     "https://graph.facebook.com/v23.0/TU_PHONE_NUMBER_ID?fields=quality_rating" \
     -H "Authorization: Bearer TU_ACCESS_TOKEN"
   ```

   **Quality Ratings**:
   - 🟢 **GREEN**: Excelente (90%+ de usuarios satisfechos)
   - 🟡 **YELLOW**: Advertencia (needs improvement)
   - 🔴 **RED**: Crítico (riesgo de suspensión)

2. **Messaging Limits**:
   - Monitorea cuántas conversaciones usas vs límite
   - Si te acercas al límite, escala tier

3. **Template Rejections**:
   - Si Meta rechaza templates, investiga por qué
   - Ajusta contenido según feedback

#### Alertas Automáticas

```typescript
// lib/monitoring.ts
export async function checkQualityRating(): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}?fields=quality_rating`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    }
  );

  const data = await response.json();

  if (data.quality_rating === 'YELLOW' || data.quality_rating === 'RED') {
    // Enviar alerta a Slack/Email
    await sendAlert({
      severity: data.quality_rating === 'RED' ? 'CRITICAL' : 'WARNING',
      message: `WhatsApp quality rating is ${data.quality_rating}`,
      details: data
    });
  }
}
```

#### Cron Job de Monitoreo

```typescript
// app/api/cron/monitor-quality/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  // Verificar token de cron
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await checkQualityRating();

  return new Response('OK', { status: 200 });
}
```

En `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/monitor-quality",
      "schedule": "0 12 * * *"
    }
  ]
}
```

### Paso 6.7: Mantener Buen Quality Rating

#### Mejores Prácticas

1. ✅ **Opt-In Claro**:
   - Usuarios deben saber que recibirán mensajes
   - Documenta el proceso de opt-in

2. ✅ **Opt-Out Fácil**:
   - Permite que usuarios escriban "STOP"
   - Respeta inmediatamente

3. ✅ **Mensajes Útiles**:
   - Solo envía contenido valioso
   - No spam

4. ✅ **Responde Rápido**:
   - Ideal: <1 minuto
   - Máximo: <15 minutos

5. ✅ **Maneja Errores**:
   - Si algo falla, informa al usuario
   - No dejes mensajes sin respuesta

#### Qué Evitar

❌ **No envíes mensajes no solicitados**
❌ **No uses templates MARKETING sin opt-in**
❌ **No pidas información sensible (contraseñas, SSN)**
❌ **No uses lenguaje engañoso o clickbait**
❌ **No envíes contenido ilegal o dañino**

### Paso 6.8: Configurar Business Profile

Mejora la experiencia del usuario:

1. Ve a **WhatsApp** → **Phone Numbers** → **Business Profile**
2. Completa información:

```yaml
Business Description:
  Asistente virtual de IA para gestión de agendas y recordatorios.
  Agenda tus citas, crea recordatorios y organiza tu día con solo enviar
  un mensaje.

Business Email: contacto@migue.ai
Business Website: https://migue.ai

Business Address:
  [Dirección de tu negocio]

Business Industry: Technology
Business Sub-category: AI Assistant

Profile Photo: [Logo de migue.ai - 640x640px]
```

3. Guarda cambios

Los usuarios verán esta info al hacer clic en tu nombre en WhatsApp.

---

## Legal Requirements

### Privacy Policy (Requerido)

Meta requiere que tengas una Privacy Policy pública.

#### Secciones Requeridas

Tu Privacy Policy debe incluir:

1. **Qué datos recoges**:
   - Número de teléfono
   - Nombre de usuario
   - Mensajes enviados
   - Metadata (timestamp, etc.)

2. **Cómo usas los datos**:
   - Procesar solicitudes
   - Enviar recordatorios
   - Mejorar el servicio

3. **Con quién compartes datos**:
   - Third-party services (OpenAI, Supabase, etc.)
   - Asegúrate de mencionar TODOS los servicios

4. **Cómo proteges datos**:
   - Encriptación
   - Acceso restringido
   - Cumplimiento de estándares

5. **Derechos del usuario**:
   - Acceso a datos
   - Eliminación de datos
   - Opt-out

#### Template de Privacy Policy

```markdown
# Privacy Policy - migue.ai

**Last Updated**: [Fecha]

## 1. Introduction

migue.ai ("we," "our," "us") operates a WhatsApp-based AI assistant that helps users manage their schedules and reminders. This Privacy Policy explains how we collect, use, and protect your information.

## 2. Information We Collect

### 2.1 Information You Provide
- Phone number (for WhatsApp communication)
- Display name (from WhatsApp profile)
- Messages you send to our bot
- Appointments, reminders, and tasks you create

### 2.2 Automatically Collected Information
- Message timestamps
- Usage patterns
- Technical data (IP address, device type)

## 3. How We Use Your Information

We use your information to:
- Process your requests and create reminders/appointments
- Send you scheduled reminders and notifications
- Improve our AI assistant's performance
- Provide customer support
- Comply with legal obligations

## 4. Data Sharing and Third Parties

We share your data with:
- **OpenAI**: For AI processing (subject to OpenAI's privacy policy)
- **Supabase**: For data storage (encrypted)
- **Vercel**: For hosting (secure infrastructure)
- **Meta/WhatsApp**: For message delivery

We do NOT sell your data to third parties.

## 5. Data Security

We protect your data through:
- End-to-end encryption for messages
- Secure database storage with encryption at rest
- Access controls and authentication
- Regular security audits

## 6. Your Rights

You have the right to:
- Access your data: Contact us at contacto@migue.ai
- Delete your data: Send "DELETE MY DATA" to our WhatsApp
- Opt-out: Send "STOP" at any time
- Correct inaccurate data: Update via WhatsApp

## 7. Data Retention

We retain your data for:
- Active users: Duration of service usage
- Inactive users: 90 days after last activity
- Deleted accounts: 30 days (for recovery), then permanently deleted

## 8. Children's Privacy

Our service is not intended for users under 13 years old. We do not knowingly collect data from children.

## 9. International Data Transfers

Your data may be transferred to and processed in countries outside Colombia. We ensure appropriate safeguards are in place.

## 10. Changes to This Policy

We may update this Privacy Policy. Material changes will be notified via WhatsApp or email.

## 11. Contact Us

For privacy questions or requests:
- Email: contacto@migue.ai
- WhatsApp: [Your business number]
- Website: https://migue.ai

---

**Compliance**: This policy complies with WhatsApp Business Messaging Policy, GDPR, and Colombian data protection laws.
```

Publica esto en: `https://migue.ai/privacy`

### Terms of Service (Recomendado)

Aunque no es obligatorio para App Review, es recomendado.

#### Template de Terms of Service

```markdown
# Terms of Service - migue.ai

**Last Updated**: [Fecha]

## 1. Acceptance of Terms

By using migue.ai's WhatsApp bot, you agree to these Terms of Service.

## 2. Description of Service

migue.ai provides an AI-powered assistant via WhatsApp for managing schedules, reminders, and appointments.

## 3. User Obligations

You agree to:
- Provide accurate information
- Not use the service for illegal purposes
- Not abuse or spam the service
- Comply with WhatsApp's Terms of Service

## 4. Opt-In and Opt-Out

- **Opt-In**: By sending a message to our bot, you opt in to receive responses
- **Opt-Out**: Send "STOP" at any time to stop receiving messages

## 5. Service Availability

We strive for 99.9% uptime but do not guarantee uninterrupted service.

## 6. Limitations of Liability

migue.ai is not liable for:
- Missed reminders due to technical issues
- Data loss or corruption
- Third-party service failures

## 7. Modifications

We may modify these terms. Continued use constitutes acceptance.

## 8. Termination

We reserve the right to terminate accounts that violate these terms.

## 9. Governing Law

These terms are governed by Colombian law.

## 10. Contact

For questions: contacto@migue.ai
```

Publica esto en: `https://migue.ai/terms`

### WhatsApp Business Policy Compliance

Lee y cumple con: [WhatsApp Business Policy](https://business.whatsapp.com/policy)

#### Puntos Clave

1. **Opt-In Requerido**:
   - Usuario debe consentir explícitamente
   - Debe saber qué tipo de mensajes recibirá

2. **Opt-Out Fácil**:
   - Responde a "STOP" inmediatamente
   - No envíes más mensajes después de opt-out

3. **No Spam**:
   - Solo mensajes solicitados o útiles
   - Respeta frecuencia razonable

4. **Información Sensible**:
   - NO pidas contraseñas
   - NO pidas números de tarjeta de crédito
   - NO pidas información médica privada

5. **Contenido Prohibido**:
   - NO contenido ilegal
   - NO violencia o odio
   - NO desinformación

---

## Checklist Completo

Usa este checklist para verificar que completaste todo:

### Pre-Requisitos ✅

- [ ] Documentos legales del negocio preparados
- [ ] Website https://migue.ai activo
- [ ] Privacy Policy publicada en website
- [ ] Número de WhatsApp nuevo disponible
- [ ] Email de negocio configurado

### Fase 1: Business Manager ✅

- [ ] Meta Business Manager creado
- [ ] Business info completada
- [ ] Usuarios agregados (si aplica)

### Fase 2: Business Verification ✅

- [ ] Business verification iniciada
- [ ] Documentos subidos
- [ ] Teléfono verificado
- [ ] Aprobación recibida (1-7 días)

### Fase 3: App Configuration ✅

- [ ] Facebook App creada
- [ ] WhatsApp product agregado
- [ ] WABA (WhatsApp Business Account) creado
- [ ] Número de teléfono agregado y verificado
- [ ] System User Access Token generado
- [ ] Phone Number ID copiado
- [ ] WABA ID copiado
- [ ] Webhook configurado
- [ ] Webhook URL verificada por Meta
- [ ] App Secret copiado

### Fase 4: Testing ✅

- [ ] Webhook local funciona (GET)
- [ ] Webhook local funciona (POST)
- [ ] Números de prueba agregados (hasta 5)
- [ ] Template "hello_world" enviado con éxito
- [ ] Mensaje de prueba recibido en webhook
- [ ] Template personalizado creado
- [ ] Template personalizado aprobado
- [ ] Bot responde correctamente a mensajes

### Fase 5: App Review ✅

- [ ] Use case description escrita
- [ ] Screencast #1 (whatsapp_business_messaging) grabado
- [ ] Screencast #2 (whatsapp_business_management) grabado
- [ ] Videos subidos a Google Drive/Dropbox
- [ ] Links de videos configurados como públicos
- [ ] App Review submission enviada
- [ ] Aprobación recibida (2-7 días)

### Fase 6: Production ✅

- [ ] Display name solicitado
- [ ] Display name aprobado (1-3 días)
- [ ] Two-step verification configurada
- [ ] Environment variables actualizadas en Vercel
- [ ] Deploy a producción realizado
- [ ] Webhook en producción funcionando
- [ ] Quality rating monitoreado
- [ ] Business profile completado
- [ ] Alertas de monitoreo configuradas

### Legal ✅

- [ ] Privacy Policy publicada
- [ ] Terms of Service publicada (recomendado)
- [ ] WhatsApp Business Policy revisada
- [ ] Proceso de opt-in documentado
- [ ] Proceso de opt-out implementado

---

## Troubleshooting

### Problemas Comunes y Soluciones

#### 1. Business Verification Rechazada

**Síntoma**: Email de Meta diciendo que verificación fue rechazada.

**Causas Comunes**:
- Documentos ilegibles
- Nombre no coincide
- Dirección no coincide
- Documentos expirados

**Solución**:
```bash
1. Lee el email de rechazo - Meta explica el motivo
2. Corrige el problema identificado
3. Re-sube documentos
4. Espera nueva revisión (1-3 días)
```

#### 2. Webhook No Recibe Mensajes

**Síntoma**: Envías mensaje al bot pero webhook no lo recibe.

**Debug Steps**:

1. **Verifica que webhook esté configurado**:
   ```bash
   # En Meta Dashboard
   WhatsApp → Configuration → Webhook
   # Debe mostrar: "Callback URL verified"
   ```

2. **Verifica suscripción a eventos**:
   ```bash
   # Debe estar checked:
   ☑ messages
   ```

3. **Verifica en logs de Vercel**:
   ```bash
   vercel logs --follow
   ```

4. **Test webhook manualmente**:
   ```bash
   curl -X POST https://migue.ai/api/whatsapp/webhook \
     -H "Content-Type: application/json" \
     -H "X-Hub-Signature-256: sha256=test" \
     -d '{"test": "payload"}'
   ```

**Soluciones**:
- ✅ Asegúrate que webhook retorne 200 OK en <5 segundos
- ✅ Verifica que validación de firma no esté bloqueando
- ✅ Chequea firewall de Vercel

#### 3. App Review Rechazado

**Síntoma**: Email de Meta diciendo que App Review fue rechazado.

**Causas Comunes**:
- Screencast incompleto
- Use case poco claro
- Funcionalidad no mostrada
- Violación de políticas

**Solución**:

1. **Lee el feedback de Meta**:
   ```
   Example rejection:
   "The screencast does not show your app sending a WhatsApp message.
   Please provide a screencast that shows the complete flow."
   ```

2. **Identifica qué falta**:
   - ¿Mostraste tu app enviando mensaje?
   - ¿Mostraste WhatsApp recibiendo mensaje?
   - ¿El flujo está completo?

3. **Re-graba screencast**:
   - Sigue el guion del Paso 5.3 exactamente
   - Asegúrate de incluir TODOS los pasos

4. **Re-envía App Review**:
   - Puedes re-enviar inmediatamente
   - Meta revisará en 2-7 días

#### 4. Template Rechazado

**Síntoma**: Template no es aprobado por Meta.

**Causas Comunes**:
- Lenguaje promocional
- Información engañosa
- Violación de políticas
- Categoría incorrecta

**Solución**:

1. **Revisa el motivo de rechazo**:
   ```bash
   # En Meta Dashboard
   WhatsApp → Message Templates
   # Busca tu template rechazado
   # Haz clic para ver razón
   ```

2. **Ajusta el contenido**:
   ```
   ❌ Mal: "OFERTA ESPECIAL! Compra ahora con 50% de descuento!!!"
   ✅ Bien: "Tu cita está confirmada para el {{1}} a las {{2}}"
   ```

3. **Usa categoría correcta**:
   - UTILITY: Transacciones, recordatorios, confirmaciones
   - MARKETING: Promociones, ofertas
   - AUTHENTICATION: Códigos OTP

4. **Re-envía template**:
   - Crea nuevo template con ajustes
   - Espera aprobación (1-24 horas)

#### 5. Quality Rating YELLOW o RED

**Síntoma**: Quality rating baja a YELLOW o RED.

**Causas**:
- Usuarios bloquean tu número
- Usuarios reportan como spam
- Tasa de respuesta baja
- Mensajes no solicitados

**Solución Inmediata**:

1. **Para envío de mensajes proactivos**:
   ```typescript
   // Deshabilita cron jobs de mensajería
   // Hasta identificar el problema
   ```

2. **Analiza qué pasó**:
   ```bash
   # Revisa logs de mensajes enviados
   # Identifica qué tipo de mensajes causaron blocks/reports
   ```

3. **Mejora la experiencia**:
   - ✅ Responde más rápido
   - ✅ Envía solo mensajes útiles
   - ✅ Respeta opt-out inmediatamente
   - ✅ Mejora relevancia de contenido

4. **Monitorea recovery**:
   ```bash
   # Quality rating se recupera en 7-14 días
   # Si mantienes buenas prácticas
   ```

**Prevención**:
```typescript
// Implementa confirmación de opt-in
async function confirmOptIn(phoneNumber: string): Promise<boolean> {
  await sendMessage(phoneNumber,
    '¿Te gustaría recibir recordatorios de migue.ai? ' +
    'Responde SÍ para confirmar.'
  );

  // Espera confirmación
  // Solo envía mensajes proactivos si usuario confirma
}
```

#### 6. Rate Limit Alcanzado

**Síntoma**: Error 429 al enviar mensajes.

**Error**:
```json
{
  "error": {
    "message": "Rate limit exceeded",
    "code": 130429
  }
}
```

**Solución**:

1. **Verifica tu tier actual**:
   ```bash
   curl "https://graph.facebook.com/v23.0/TU_PHONE_ID?fields=messaging_limit_tier" \
     -H "Authorization: Bearer TU_TOKEN"
   ```

2. **Implementa queue con throttling**:
   ```typescript
   // lib/message-queue.ts
   export class MessageQueue {
     private maxMessagesPerDay: number;
     private sentToday: Set<string> = new Set();

     async send(phoneNumber: string, message: string): Promise<void> {
       if (this.sentToday.size >= this.maxMessagesPerDay) {
         throw new Error('Daily limit reached');
       }

       await sendMessage(phoneNumber, message);
       this.sentToday.add(phoneNumber);
     }
   }
   ```

3. **Espera escalamiento automático**:
   - Meta escala automáticamente si quality rating es GREEN
   - Puede tomar 7-30 días para siguiente tier

#### 7. Webhook Signature Validation Falla

**Síntoma**: Webhook rechaza mensajes con error 401.

**Error en logs**:
```
[webhook] Invalid signature
```

**Debug**:

```typescript
// Agrega logging detallado
export async function validateSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');

  console.log('Received signature:', signature);
  console.log('Body length:', rawBody.length);
  console.log('Body sample:', rawBody.substring(0, 100));

  const [algorithm, provided] = signature!.split('=');
  const expected = await hmacSha256Hex(process.env.WHATSAPP_APP_SECRET!, rawBody);

  console.log('Expected:', expected);
  console.log('Provided:', provided);
  console.log('Match:', expected === provided);

  return expected === provided;
}
```

**Causas Comunes**:
- Body del request fue modificado antes de validar
- APP_SECRET incorrecto
- Encoding issues (UTF-8)

**Solución**:
```typescript
// IMPORTANTE: Lee raw body ANTES de cualquier parsing
export async function POST(req: Request): Promise<Response> {
  // 1. Lee raw body primero
  const rawBody = await req.text();

  // 2. Valida firma con raw body
  const isValid = await validateSignature(req, rawBody);

  // 3. Ahora sí parsea JSON
  const payload = JSON.parse(rawBody);

  // ...
}
```

#### 8. Two-Step Verification Bloqueada

**Síntoma**: Olvidaste tu PIN y no puedes acceder.

**Solución**:

1. **Usa email de recuperación**:
   - Meta envía código al email que configuraste
   - Ingresa código para resetear PIN

2. **Si no tienes email de recuperación**:
   - Contacta Meta Support
   - Deberás probar ownership del número
   - Puede tomar 3-7 días

**Prevención**:
- ✅ Guarda PIN en password manager
- ✅ Configura email de recuperación
- ✅ Documenta en equipo quién tiene acceso

---

## Recursos Adicionales

### Documentación Oficial de Meta

- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [App Review Guidelines](https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review)
- [Business Verification](https://www.facebook.com/business/help/2058515294227817)
- [WhatsApp Business Policy](https://business.whatsapp.com/policy)

### Herramientas Útiles

- [Graph API Explorer](https://developers.facebook.com/tools/explorer/) - Testear API calls
- [Webhook Tester](https://webhook.site/) - Debug webhooks
- [Postman Collection](https://www.postman.com/meta/workspace/whatsapp-business-platform) - WhatsApp API

### Comunidad y Support

- [Meta Developer Community](https://developers.facebook.com/community/)
- [WhatsApp Business Support](https://business.facebook.com/support)
- [Stack Overflow - whatsapp-api tag](https://stackoverflow.com/questions/tagged/whatsapp-api)

### Documentación Interna de migue.ai

- [WhatsApp API v23 Guide](./api-v23-guide.md)
- [Multi-Tenant Architecture](./multi-tenant-architecture.md)
- [Webhook Specification](../../reference/whatsapp-webhook-spec.md)
- [Pricing Guide 2025](./pricing-guide-2025.md)

---

## Resumen Ejecutivo

### Timeline Total

```
Día 1:     Business Manager + App Configuration (1 hora)
Día 1-7:   Business Verification (espera de Meta)
Día 8:     Testing Environment (2 horas)
Día 8-9:   Screencast creation (3 horas)
Día 9:     App Review submission (1 hora)
Día 9-16:  App Review (espera de Meta)
Día 16:    Production Deployment (2 horas)

Total: 16 días (9 horas de trabajo efectivo)
```

### Costos

```
Setup Inicial:
├── Business Verification: $0
├── App Creation: $0
├── WhatsApp Number: $0-$20/mes (depende del proveedor)
└── Total Setup: $0

Costos Mensuales:
├── WhatsApp Messaging: $0 (dentro de 24h window)
├── Template Messages: Variable (por uso)
├── Vercel: $20/mes (Pro)
├── Supabase: $25/mes (Pro)
└── Total Mensual: ~$45/mes + mensajes
```

### Checklist Rápido

**Antes de empezar**:
- [ ] Documentos legales listos
- [ ] Website con Privacy Policy
- [ ] Número de WhatsApp disponible

**Para completar**:
- [ ] Business verificado (1-7 días)
- [ ] App configurada (1 hora)
- [ ] Testing exitoso (2 horas)
- [ ] App Review aprobado (2-7 días)
- [ ] Producción live (2 horas)

**Post-launch**:
- [ ] Monitorear quality rating diariamente
- [ ] Responder a usuarios <15 minutos
- [ ] Respetar opt-out inmediatamente
- [ ] Mantener compliance con políticas

---

**Última Actualización**: 2025-10-10
**Versión**: 1.0
**Autor**: claude-master
**Estado**: Completo - Listo para usar

**Próximos Pasos**: Comienza con [Fase 1: Business Manager Setup](#fase-1-meta-business-manager-setup)
