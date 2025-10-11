# Parte 3: Templates y Casos de Uso

**[← Parte 2: Implementación](./02-implementacion-tecnica.md)** | **[Volver al Índice](./README.md)** | **[Siguiente: Seguridad y Testing →](./04-seguridad-testing.md)**

---

## Tabla de Contenidos

1. [Templates Predefinidos](#templates-predefinidos)
2. [Template 1: Lead Generation](#template-1-lead-generation)
3. [Template 2: Appointment Booking](#template-2-appointment-booking)
4. [Template 3: Feedback Collection](#template-3-feedback-collection)
5. [Integración con Sistema AI](#integración-con-sistema-ai)
6. [Crear Templates Personalizados](#crear-templates-personalizados)
7. [Ejemplos Avanzados](#ejemplos-avanzados)

---

## Templates Predefinidos

Los templates predefinidos están disponibles en `lib/whatsapp-flows.ts`:

```typescript
export const FLOW_TEMPLATES = {
  LEAD_GENERATION: {
    id: 'lead_generation_flow',
    name: 'Lead Generation',
    description: 'Collect contact information from potential customers',
    cta: 'Get Started',
    bodyText: 'Please provide your contact information',
  },
  APPOINTMENT_BOOKING: {
    id: 'appointment_booking_flow',
    name: 'Appointment Booking',
    description: 'Schedule appointments with customers',
    cta: 'Book Appointment',
    bodyText: 'Schedule your appointment',
  },
  FEEDBACK_COLLECTION: {
    id: 'feedback_flow',
    name: 'Feedback Collection',
    description: 'Collect customer feedback and ratings',
    cta: 'Give Feedback',
    bodyText: 'We value your feedback',
  },
};
```

---

## Template 1: Lead Generation

### Overview

Formulario de contacto para capturar información de clientes potenciales.

**Tipo:** Navigate Flow (autocontenido)
**Complejidad:** ⭐ Baja
**Use Cases:**
- Formularios de contacto en sitios web
- Solicitudes de información
- Newsletter signup
- Registro de interesados

### Flow JSON

```json
{
  "version": "5.0",
  "screens": [
    {
      "id": "LEAD_FORM",
      "title": "Información de Contacto",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "¡Hablemos!"
          },
          {
            "type": "TextBody",
            "text": "Completa tus datos y nos pondremos en contacto contigo pronto."
          },
          {
            "type": "TextInput",
            "name": "full_name",
            "label": "Nombre Completo *",
            "input-type": "text",
            "required": true,
            "helper-text": "Tu nombre y apellido"
          },
          {
            "type": "TextInput",
            "name": "email",
            "label": "Email *",
            "input-type": "email",
            "required": true,
            "helper-text": "Te enviaremos la información aquí"
          },
          {
            "type": "TextInput",
            "name": "phone",
            "label": "Teléfono",
            "input-type": "phone",
            "required": false,
            "helper-text": "Opcional - para contacto rápido"
          },
          {
            "type": "TextInput",
            "name": "company",
            "label": "Empresa",
            "input-type": "text",
            "required": false
          },
          {
            "type": "TextArea",
            "name": "message",
            "label": "¿En qué podemos ayudarte? *",
            "required": true,
            "helper-text": "Cuéntanos sobre tu proyecto o necesidad"
          },
          {
            "type": "CheckboxGroup",
            "name": "interests",
            "label": "Áreas de Interés",
            "required": false,
            "data-source": [
              {
                "id": "product_demo",
                "title": "Demo del producto"
              },
              {
                "id": "pricing",
                "title": "Información de precios"
              },
              {
                "id": "integration",
                "title": "Integraciones"
              },
              {
                "id": "support",
                "title": "Soporte técnico"
              }
            ]
          },
          {
            "type": "OptIn",
            "name": "consent",
            "label": "Acepto recibir comunicaciones de marketing",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Enviar",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### Enviar el Flow

```typescript
import { sendFlow, FLOW_TEMPLATES } from '@/lib/whatsapp-flows';

// Caso 1: Uso básico
await sendFlow(
  userPhone,
  FLOW_TEMPLATES.LEAD_GENERATION.id,
  FLOW_TEMPLATES.LEAD_GENERATION.cta,
  FLOW_TEMPLATES.LEAD_GENERATION.bodyText
);

// Caso 2: Con personalización
await sendFlow(
  userPhone,
  FLOW_TEMPLATES.LEAD_GENERATION.id,
  '¡Comenzar!',
  `Hola ${userName}, cuéntanos más sobre ti para poder ayudarte mejor.`,
  {
    header: 'Miguel AI',
    footer: 'Powered by migue.ai'
  }
);
```

### Procesamiento de Respuesta

```typescript
// app/api/whatsapp/webhook/route.ts

import { getSupabaseServerClient } from '@/lib/supabase';
import { sendWhatsAppText } from '@/lib/whatsapp';

async function handleLeadGeneration(from: string, flowData: any) {
  const supabase = getSupabaseServerClient();

  // 1. Extraer datos del Flow
  const {
    full_name,
    email,
    phone,
    company,
    message,
    interests,
    consent
  } = flowData;

  // 2. Guardar lead en base de datos
  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      phone_number: from,
      full_name,
      email,
      phone,
      company,
      message,
      interests: interests || [],
      consent_marketing: consent,
      source: 'whatsapp_flow',
      status: 'new',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving lead:', error);
    await sendWhatsAppText(
      from,
      '❌ Hubo un error al procesar tu información. Por favor, intenta de nuevo.'
    );
    return;
  }

  // 3. Notificar al equipo
  await notifyTeam({
    type: 'new_lead',
    lead: {
      id: lead.id,
      name: full_name,
      email,
      message,
      source: 'WhatsApp Flow'
    }
  });

  // 4. Enviar email de bienvenida
  await sendWelcomeEmail(email, full_name);

  // 5. Asignar a vendedor disponible
  const assignedSalesperson = await assignToSalesperson(lead.id);

  // 6. Responder al usuario en WhatsApp
  await sendWhatsAppText(
    from,
    `✅ ¡Gracias ${full_name}!\n\n` +
    `Recibimos tu información. ${assignedSalesperson.name} se pondrá en contacto contigo dentro de las próximas 24 horas.\n\n` +
    `Te enviamos un email de confirmación a ${email}.\n\n` +
    `¿Hay algo más en lo que pueda ayudarte?`
  );

  // 7. Crear tarea en CRM (opcional)
  await createCRMTask({
    type: 'follow_up_lead',
    lead_id: lead.id,
    assigned_to: assignedSalesperson.id,
    due_date: addHours(new Date(), 24)
  });
}
```

### Integración con AI Agent

```typescript
// lib/claude-agents.ts

export class LeadQualificationAgent {
  async qualifyLead(leadData: any) {
    const prompt = `
      Analiza este lead y determina:
      1. Nivel de urgencia (alto/medio/bajo)
      2. Fit con nuestro producto (excelente/bueno/regular)
      3. Próximos pasos recomendados

      Datos del lead:
      - Nombre: ${leadData.full_name}
      - Empresa: ${leadData.company || 'No especificada'}
      - Mensaje: ${leadData.message}
      - Intereses: ${leadData.interests.join(', ')}
    `;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4.5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return parseQualificationResponse(response);
  }
}

// Uso en webhook handler
async function handleLeadGeneration(from: string, flowData: any) {
  // ... guardar lead en DB ...

  // Calificar lead con AI
  const agent = new LeadQualificationAgent();
  const qualification = await agent.qualifyLead(flowData);

  // Actualizar lead con calificación
  await supabase
    .from('leads')
    .update({
      urgency: qualification.urgency,
      product_fit: qualification.fit,
      ai_notes: qualification.notes,
      recommended_next_steps: qualification.nextSteps
    })
    .eq('id', lead.id);

  // Routing inteligente basado en calificación
  if (qualification.urgency === 'high' && qualification.fit === 'excellent') {
    // Asignar a top salesperson + notificación urgente
    await assignToTopSalesperson(lead.id, { urgent: true });
  } else {
    // Flujo normal
    await assignToSalesperson(lead.id);
  }
}
```

### Validación Backend

```typescript
// lib/whatsapp-flows.ts

function validateLeadData(data: Record<string, unknown>): boolean {
  // Validar campos requeridos
  if (!data.full_name || !data.email || !data.message) {
    return false;
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email as string)) {
    return false;
  }

  // Validar longitud de mensaje
  if ((data.message as string).length < 10) {
    return false;
  }

  // Validar consentimiento
  if (!data.consent) {
    return false;
  }

  return true;
}
```

---

## Template 2: Appointment Booking

### Overview

Sistema de reserva de citas con verificación de disponibilidad en tiempo real.

**Tipo:** Data Exchange Flow (dinámico)
**Complejidad:** ⭐⭐⭐ Alta
**Use Cases:**
- Reservas médicas
- Consultas profesionales
- Servicios de belleza
- Tutorías/clases

### Flow JSON

```json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://migue.app/api/whatsapp/flows",
  "screens": [
    {
      "id": "SELECT_SERVICE",
      "title": "Seleccionar Servicio",
      "data": {
        "services": {
          "type": "array",
          "__example__": [
            {
              "id": "1",
              "title": "Consulta General",
              "description": "30 min - $150"
            }
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Reserva tu Cita"
          },
          {
            "type": "TextBody",
            "text": "Selecciona el servicio que necesitas"
          },
          {
            "type": "Dropdown",
            "name": "service",
            "label": "Tipo de Servicio *",
            "required": true,
            "data-source": "${data.services}"
          },
          {
            "type": "TextArea",
            "name": "notes",
            "label": "Notas (opcional)",
            "required": false,
            "helper-text": "Información adicional sobre tu consulta"
          },
          {
            "type": "Footer",
            "label": "Siguiente",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "service_id": "${form.service}",
                "notes": "${form.notes}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "SELECT_DATE",
      "title": "Seleccionar Fecha y Hora",
      "data": {
        "available_dates": {
          "type": "array",
          "__example__": ["2025-10-15", "2025-10-16"]
        },
        "available_times": {
          "type": "array",
          "__example__": [
            {"id": "09:00", "title": "9:00 AM"},
            {"id": "10:00", "title": "10:00 AM"}
          ]
        },
        "service_name": {
          "type": "string",
          "__example__": "Consulta General"
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "${data.service_name}"
          },
          {
            "type": "DatePicker",
            "name": "date",
            "label": "Fecha de la Cita *",
            "required": true,
            "available-dates": "${data.available_dates}"
          },
          {
            "type": "Dropdown",
            "name": "time",
            "label": "Horario *",
            "required": true,
            "data-source": "${data.available_times}"
          },
          {
            "type": "Footer",
            "label": "Confirmar",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "date": "${form.date}",
                "time": "${form.time}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRMATION",
      "title": "Confirmación",
      "data": {
        "appointment_id": {
          "type": "string",
          "__example__": "APT-12345"
        },
        "service_name": {
          "type": "string",
          "__example__": "Consulta General"
        },
        "date": {
          "type": "string",
          "__example__": "15 de Octubre, 2025"
        },
        "time": {
          "type": "string",
          "__example__": "9:00 AM"
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "¡Cita Confirmada! ✅"
          },
          {
            "type": "TextBody",
            "text": "Tu cita ha sido reservada exitosamente."
          },
          {
            "type": "TextBody",
            "text": "📋 ID: ${data.appointment_id}\n📅 ${data.date}\n⏰ ${data.time}\n🏥 ${data.service_name}"
          },
          {
            "type": "TextCaption",
            "text": "Te enviaremos un recordatorio 24 horas antes de tu cita."
          },
          {
            "type": "Footer",
            "label": "Cerrar",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### Enviar el Flow

```typescript
// Con AI Agent que detecta intención de reserva
export class SchedulingAgent {
  async handleSchedulingIntent(userPhone: string, context: any) {
    // Detectar que usuario quiere agendar
    // ... lógica de detección ...

    // Enviar Flow de appointment booking
    await sendFlow(
      userPhone,
      FLOW_TEMPLATES.APPOINTMENT_BOOKING.id,
      FLOW_TEMPLATES.APPOINTMENT_BOOKING.cta,
      `¡Perfecto! Te ayudo a agendar tu cita.\n\nPresiona el botón para ver disponibilidad en tiempo real.`,
      {
        flowType: 'data_exchange',
        initialScreen: 'SELECT_SERVICE',
        initialData: {
          user_name: context.userName || 'Cliente'
        }
      }
    );
  }
}
```

### Backend: Data Exchange Handler

```typescript
// app/api/whatsapp/flows/route.ts (extendido)

async function handleAppointmentFlow(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  const supabase = getSupabaseServerClient();

  switch (screen) {
    case 'SELECT_SERVICE': {
      // 1. Obtener servicios activos
      const { data: services } = await supabase
        .from('services')
        .select('id, name, duration, price, description')
        .eq('active', true)
        .order('name');

      return {
        version: '3.0',
        screen: 'SELECT_SERVICE',
        data: {
          services: services?.map(s => ({
            id: s.id,
            title: s.name,
            description: `${s.duration} min - $${s.price}`
          })) || []
        }
      };
    }

    case 'SELECT_DATE': {
      // 2. Usuario seleccionó servicio, obtener disponibilidad
      const serviceId = data.service_id as string;

      // Obtener info del servicio
      const { data: service } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

      // Consultar Google Calendar para disponibilidad
      const availability = await getServiceAvailability(
        serviceId,
        service.duration
      );

      // Guardar service_id en session
      await supabase
        .from('flow_sessions')
        .update({
          session_data: {
            ...session.session_data,
            service_id: serviceId,
            notes: data.notes || ''
          }
        })
        .eq('flow_token', session.flow_token);

      return {
        version: '3.0',
        screen: 'SELECT_DATE',
        data: {
          service_name: service.name,
          available_dates: availability.dates,
          available_times: availability.times.map(t => ({
            id: t.time,
            title: formatTime(t.time)
          }))
        }
      };
    }

    case 'CONFIRMATION': {
      // 3. Usuario confirmó fecha/hora, crear appointment
      const serviceId = session.session_data.service_id;
      const selectedDate = data.date as string;
      const selectedTime = data.time as string;
      const notes = session.session_data.notes;

      // Validar disponibilidad final (race condition protection)
      const isAvailable = await checkSlotAvailability(
        serviceId,
        selectedDate,
        selectedTime
      );

      if (!isAvailable) {
        return {
          version: '3.0',
          screen: 'SELECT_DATE',
          data: {
            error: 'Este horario ya no está disponible. Por favor selecciona otro.',
            ...session.session_data
          }
        };
      }

      // Crear evento en Google Calendar
      const calendarEvent = await createCalendarEvent({
        serviceId,
        date: selectedDate,
        time: selectedTime,
        userId: session.user_id,
        notes
      });

      // Guardar appointment en DB
      const { data: appointment } = await supabase
        .from('appointments')
        .insert({
          user_id: session.user_id,
          service_id: serviceId,
          scheduled_date: `${selectedDate}T${selectedTime}:00`,
          calendar_event_id: calendarEvent.id,
          notes,
          status: 'confirmed'
        })
        .select()
        .single();

      // Generar ID legible
      const appointmentId = `APT-${appointment.id.slice(0, 8).toUpperCase()}`;

      // Programar recordatorio (24h antes)
      await scheduleReminder({
        type: 'appointment_reminder',
        appointment_id: appointment.id,
        send_at: subHours(parseISO(`${selectedDate}T${selectedTime}:00`), 24)
      });

      // Enviar email de confirmación
      await sendAppointmentConfirmationEmail({
        user_id: session.user_id,
        appointment_id: appointmentId,
        service_name: calendarEvent.summary,
        date: selectedDate,
        time: selectedTime
      });

      return {
        version: '3.0',
        screen: 'CONFIRMATION',
        data: {
          appointment_id: appointmentId,
          service_name: calendarEvent.summary,
          date: formatDate(selectedDate),
          time: formatTime(selectedTime)
        }
      };
    }

    default:
      return {
        version: '3.0',
        screen: 'SELECT_SERVICE',
        data: {}
      };
  }
}
```

### Google Calendar Integration

```typescript
// lib/google-calendar.ts

import { google } from 'googleapis';

const calendar = google.calendar({ version: 'v3', auth: getGoogleAuth() });

export async function getServiceAvailability(
  serviceId: string,
  duration: number
): Promise<{ dates: string[]; times: Array<{ time: string; available: boolean }> }> {
  const startDate = new Date();
  const endDate = addDays(startDate, 30);

  // 1. Obtener eventos existentes en el rango
  const { data } = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  const bookedSlots = new Set(
    data.items?.map(event => ({
      date: format(parseISO(event.start!.dateTime!), 'yyyy-MM-dd'),
      time: format(parseISO(event.start!.dateTime!), 'HH:mm')
    })) || []
  );

  // 2. Generar fechas disponibles (lun-vie)
  const dates: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const date = addDays(startDate, i);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(format(date, 'yyyy-MM-dd'));
    }
  }

  // 3. Generar horarios (9 AM - 5 PM, cada hora)
  const times = [];
  for (let hour = 9; hour < 17; hour++) {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    times.push({ time, available: true });
  }

  return { dates, times };
}

export async function createCalendarEvent(params: {
  serviceId: string;
  date: string;
  time: string;
  userId: string;
  notes?: string;
}) {
  const supabase = getSupabaseServerClient();

  // Obtener info del servicio y usuario
  const [{ data: service }, { data: user }] = await Promise.all([
    supabase.from('services').select('*').eq('id', params.serviceId).single(),
    supabase.from('users').select('*').eq('id', params.userId).single()
  ]);

  const startDateTime = parseISO(`${params.date}T${params.time}:00`);
  const endDateTime = addMinutes(startDateTime, service.duration);

  // Crear evento en Google Calendar
  const { data: event } = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: `${service.name} - ${user.name}`,
      description: `Cliente: ${user.name}\nTeléfono: ${user.phone_number}\n\n${params.notes || ''}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires'
      },
      attendees: [
        { email: user.email, displayName: user.name }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },  // 24h antes
          { method: 'popup', minutes: 60 }         // 1h antes
        ]
      }
    }
  });

  return event;
}

async function checkSlotAvailability(
  serviceId: string,
  date: string,
  time: string
): Promise<boolean> {
  const startDateTime = parseISO(`${date}T${time}:00`);
  const endDateTime = addHours(startDateTime, 1);

  const { data } = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: startDateTime.toISOString(),
    timeMax: endDateTime.toISOString(),
    singleEvents: true
  });

  return (data.items?.length || 0) === 0;
}
```

---

## Template 3: Feedback Collection

### Overview

Encuesta de satisfacción post-servicio para recolectar feedback estructurado.

**Tipo:** Navigate Flow (autocontenido)
**Complejidad:** ⭐⭐ Media
**Use Cases:**
- Post-purchase feedback
- Service quality ratings
- NPS surveys
- Product reviews

### Flow JSON

```json
{
  "version": "5.0",
  "screens": [
    {
      "id": "RATING_SCREEN",
      "title": "Tu Opinión",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "¿Cómo fue tu experiencia?"
          },
          {
            "type": "TextBody",
            "text": "Tu feedback nos ayuda a mejorar continuamente."
          },
          {
            "type": "RadioButtonsGroup",
            "name": "overall_satisfaction",
            "label": "Satisfacción General",
            "required": true,
            "data-source": [
              {"id": "5", "title": "Excelente ⭐⭐⭐⭐⭐"},
              {"id": "4", "title": "Muy Bueno ⭐⭐⭐⭐"},
              {"id": "3", "title": "Bueno ⭐⭐⭐"},
              {"id": "2", "title": "Regular ⭐⭐"},
              {"id": "1", "title": "Malo ⭐"}
            ]
          },
          {
            "type": "RadioButtonsGroup",
            "name": "service_speed",
            "label": "Velocidad del Servicio",
            "required": true,
            "data-source": [
              {"id": "5", "title": "Muy Rápido"},
              {"id": "4", "title": "Rápido"},
              {"id": "3", "title": "Normal"},
              {"id": "2", "title": "Lento"},
              {"id": "1", "title": "Muy Lento"}
            ]
          },
          {
            "type": "RadioButtonsGroup",
            "name": "would_recommend",
            "label": "¿Recomendarías nuestro servicio?",
            "required": true,
            "data-source": [
              {"id": "yes", "title": "Sí, definitivamente"},
              {"id": "maybe", "title": "Tal vez"},
              {"id": "no", "title": "No"}
            ]
          },
          {
            "type": "TextArea",
            "name": "comments",
            "label": "Comentarios Adicionales",
            "required": false,
            "helper-text": "Cuéntanos más sobre tu experiencia (opcional)"
          },
          {
            "type": "Footer",
            "label": "Enviar Feedback",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### Enviar Feedback Flow

```typescript
// Trigger automático después de completar servicio
async function triggerFeedbackFlow(appointmentId: string) {
  const supabase = getSupabaseServerClient();

  // Obtener datos del appointment
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      user:users(*),
      service:services(*)
    `)
    .eq('id', appointmentId)
    .single();

  if (!appointment) return;

  // Esperar 1 hora después del servicio para enviar feedback
  await scheduleTask({
    type: 'send_feedback_flow',
    execute_at: addHours(appointment.scheduled_date, 1),
    data: {
      user_phone: appointment.user.phone_number,
      user_name: appointment.user.name,
      service_name: appointment.service.name,
      appointment_id: appointmentId
    }
  });
}

// Cron job que ejecuta tareas programadas
export async function sendScheduledFeedbackFlows() {
  const tasks = await getTasksDue('send_feedback_flow');

  for (const task of tasks) {
    const { user_phone, user_name, service_name } = task.data;

    await sendFlow(
      user_phone,
      FLOW_TEMPLATES.FEEDBACK_COLLECTION.id,
      'Dar Feedback',
      `Hola ${user_name}! 👋\n\n` +
      `Esperamos que hayas tenido una buena experiencia con ${service_name}.\n\n` +
      `¿Nos regalas un minuto para contarnos cómo te fue?`
    );

    await markTaskCompleted(task.id);
  }
}
```

### Procesamiento y Analytics

```typescript
// Procesar feedback y generar analytics
async function handleFeedbackSubmission(from: string, flowData: any) {
  const supabase = getSupabaseServerClient();

  // 1. Guardar feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .insert({
      user_phone: from,
      overall_satisfaction: parseInt(flowData.overall_satisfaction),
      service_speed: parseInt(flowData.service_speed),
      would_recommend: flowData.would_recommend,
      comments: flowData.comments || null,
      source: 'whatsapp_flow',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  // 2. Calcular NPS (Net Promoter Score)
  const npsScore = calculateNPS(flowData.would_recommend, flowData.overall_satisfaction);

  await supabase
    .from('feedback')
    .update({ nps_score: npsScore })
    .eq('id', feedback.id);

  // 3. Detectar feedback negativo y alertar
  if (parseInt(flowData.overall_satisfaction) <= 2) {
    await notifyManagement({
      type: 'negative_feedback',
      severity: 'high',
      feedback_id: feedback.id,
      user_phone: from,
      rating: flowData.overall_satisfaction,
      comments: flowData.comments
    });
  }

  // 4. AI Analysis del comentario
  if (flowData.comments) {
    const agent = new FeedbackAnalysisAgent();
    const analysis = await agent.analyzeFeedback(flowData.comments);

    await supabase
      .from('feedback')
      .update({
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        action_items: analysis.actionItems
      })
      .eq('id', feedback.id);
  }

  // 5. Responder según el rating
  let responseMessage: string;

  if (parseInt(flowData.overall_satisfaction) >= 4) {
    responseMessage =
      `¡Gracias por tu excelente feedback! 🌟\n\n` +
      `Nos alegra mucho que hayas tenido una buena experiencia.\n\n` +
      `Si conoces a alguien que pueda necesitar nuestros servicios, ¡te agradeceríamos mucho una recomendación!`;
  } else if (parseInt(flowData.overall_satisfaction) === 3) {
    responseMessage =
      `Gracias por tu feedback. 👍\n\n` +
      `Trabajamos constantemente para mejorar. ¿Hay algo específico que podríamos hacer mejor?`;
  } else {
    responseMessage =
      `Lamentamos que no hayas tenido la mejor experiencia. 😞\n\n` +
      `Un miembro de nuestro equipo se pondrá en contacto contigo pronto para resolver cualquier problema.\n\n` +
      `Tu satisfacción es muy importante para nosotros.`;
  }

  await sendWhatsAppText(from, responseMessage);

  // 6. Actualizar user profile con engagement
  await supabase
    .from('users')
    .update({
      last_feedback_at: new Date().toISOString(),
      total_feedback_count: supabase.raw('total_feedback_count + 1')
    })
    .eq('phone_number', from);
}

function calculateNPS(wouldRecommend: string, satisfaction: string): number {
  // NPS: -100 to 100
  // Promoters (9-10): 1
  // Passives (7-8): 0
  // Detractors (0-6): -1

  if (wouldRecommend === 'yes' && parseInt(satisfaction) >= 4) {
    return 1;  // Promoter
  } else if (wouldRecommend === 'no' || parseInt(satisfaction) <= 2) {
    return -1;  // Detractor
  } else {
    return 0;  // Passive
  }
}
```

### AI Feedback Analysis

```typescript
// lib/claude-agents.ts

export class FeedbackAnalysisAgent {
  async analyzeFeedback(comment: string) {
    const prompt = `
      Analiza este feedback de cliente y extrae:

      1. Sentiment (positive/neutral/negative)
      2. Main topics mencionados (categorías: servicio, precio, velocidad, calidad, atención)
      3. Action items específicos que podemos tomar
      4. Urgencia (high/medium/low)

      Feedback:
      "${comment}"

      Responde en formato JSON.
    `;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4.5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return JSON.parse(extractJSON(response.content[0].text));
  }
}
```

---

## Integración con Sistema AI

### Detección de Intención → Trigger Flow

```typescript
// lib/ai-processing-v2.ts

export class ProactiveAgent {
  async processMessage(message: string, context: any): Promise<AgentResponse> {
    // Detectar intenciones del usuario
    const intent = await this.detectIntent(message, context);

    switch (intent.type) {
      case 'book_appointment':
        // Trigger appointment booking flow
        await sendFlow(
          context.userPhone,
          FLOW_TEMPLATES.APPOINTMENT_BOOKING.id,
          'Agendar Cita',
          '¡Perfecto! Te ayudo a agendar. Presiona el botón para ver disponibilidad.',
          { flowType: 'data_exchange' }
        );
        break;

      case 'request_info':
        // Trigger lead generation flow
        await sendFlow(
          context.userPhone,
          FLOW_TEMPLATES.LEAD_GENERATION.id,
          'Comenzar',
          'Con gusto te envío más información. Primero, cuéntame un poco más sobre ti.'
        );
        break;

      case 'complaint':
        // Trigger feedback flow para capturar detalles
        await sendFlow(
          context.userPhone,
          FLOW_TEMPLATES.FEEDBACK_COLLECTION.id,
          'Reportar Problema',
          'Lamento que hayas tenido problemas. Ayúdame a entender mejor la situación.'
        );
        break;
    }

    return {
      message: intent.response,
      flowTriggered: true
    };
  }
}
```

---

## Crear Templates Personalizados

### Paso 1: Definir Flow JSON

```typescript
// custom-flows/product-order.json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://migue.app/api/whatsapp/flows",
  "screens": [
    {
      "id": "SELECT_PRODUCT",
      "title": "Seleccionar Producto",
      "data": {
        "products": {
          "type": "array",
          "__example__": [
            {
              "id": "1",
              "title": "Producto A",
              "description": "$99.99 - Stock: 15"
            }
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Dropdown",
            "name": "product",
            "label": "Producto",
            "required": true,
            "data-source": "${data.products}"
          },
          {
            "type": "TextInput",
            "name": "quantity",
            "label": "Cantidad",
            "input-type": "number",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Siguiente",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "product_id": "${form.product}",
                "quantity": "${form.quantity}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

### Paso 2: Registrar Template

```typescript
// lib/whatsapp-flows.ts

export const FLOW_TEMPLATES = {
  // ... templates existentes ...

  PRODUCT_ORDER: {
    id: 'product_order_flow',
    name: 'Product Order',
    description: 'Order products with inventory validation',
    cta: 'Order Now',
    bodyText: 'Select your products and quantity',
  },
};
```

### Paso 3: Implementar Handler

```typescript
// app/api/whatsapp/flows/route.ts

async function handleProductOrderFlow(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  switch (screen) {
    case 'SELECT_PRODUCT':
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .gt('stock', 0);

      return {
        version: '3.0',
        screen: 'SELECT_PRODUCT',
        data: {
          products: products?.map(p => ({
            id: p.id,
            title: p.name,
            description: `$${p.price} - Stock: ${p.stock}`
          })) || []
        }
      };

    // ... más screens ...
  }
}
```

---

## Ejemplos Avanzados

### Multi-Step Form con Validación Condicional

```typescript
async function handleConditionalFlow(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  if (screen === 'USER_TYPE') {
    const userType = data.user_type as string;

    // Routing condicional basado en tipo de usuario
    if (userType === 'business') {
      return {
        version: '3.0',
        screen: 'BUSINESS_INFO',
        data: {
          title: 'Información de Empresa',
          fields: ['company_name', 'tax_id', 'employees']
        }
      };
    } else {
      return {
        version: '3.0',
        screen: 'PERSONAL_INFO',
        data: {
          title: 'Información Personal',
          fields: ['full_name', 'id_number']
        }
      };
    }
  }
}
```

### Flow con Payment Integration

```typescript
async function handlePaymentFlow(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  if (screen === 'PAYMENT_METHOD') {
    const amount = session.session_data.total_amount;

    // Generar link de pago con Stripe/MercadoPago
    const paymentLink = await createPaymentLink({
      amount,
      description: 'Order payment',
      metadata: {
        flow_token: session.flow_token,
        user_id: session.user_id
      }
    });

    return {
      version: '3.0',
      screen: 'PAYMENT_CONFIRMATION',
      data: {
        payment_url: paymentLink,
        amount: formatCurrency(amount),
        expires_in: '15 minutos'
      }
    };
  }
}
```

---

## Resumen

**Templates Disponibles:**
1. ✅ Lead Generation - Navigate Flow
2. ✅ Appointment Booking - Data Exchange Flow
3. ✅ Feedback Collection - Navigate Flow

**Integración AI:**
- Detección automática de intenciones
- Trigger de Flows según contexto
- Análisis de feedback con Claude
- Routing inteligente

**Best Practices:**
- Validar datos en frontend Y backend
- Usar data exchange para datos dinámicos
- Implementar error handling robusto
- Notificaciones en tiempo real
- Analytics y tracking

**Next:**
- **[Parte 4: Seguridad, Testing y Debugging →](./04-seguridad-testing.md)** - Validación, testing y mejores prácticas

---

**[← Parte 2: Implementación](./02-implementacion-tecnica.md)** | **[Volver al Índice](./README.md)** | **[Siguiente: Seguridad y Testing →](./04-seguridad-testing.md)**
