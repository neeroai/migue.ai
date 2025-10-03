export type ActionDefinition = {
  id: string
  title: string
  description?: string
  category: 'schedule' | 'reminder' | 'other'
  directResponse?: string
  replacementMessage?: string
}

const ACTION_PREFIX = 'action:'

const ACTIONS: Record<string, ActionDefinition> = {
  'action:schedule_confirm': {
    id: 'action:schedule_confirm',
    title: 'Confirmar',
    category: 'schedule',
    directResponse: '¡Perfecto! La cita queda confirmada.',
  },
  'action:schedule_reschedule': {
    id: 'action:schedule_reschedule',
    title: 'Reprogramar',
    category: 'schedule',
    replacementMessage: 'Necesito reprogramar la cita.',
  },
  'action:schedule_cancel': {
    id: 'action:schedule_cancel',
    title: 'Cancelar',
    category: 'schedule',
    replacementMessage: 'Cancela la cita, por favor.',
  },
  'action:reminder_view': {
    id: 'action:reminder_view',
    title: 'Ver recordatorios',
    category: 'reminder',
    replacementMessage: 'Muéstrame mis recordatorios.',
  },
  'action:reminder_edit': {
    id: 'action:reminder_edit',
    title: 'Editar recordatorio',
    category: 'reminder',
    replacementMessage: 'Quiero editar el recordatorio.',
  },
  'action:reminder_cancel': {
    id: 'action:reminder_cancel',
    title: 'Cancelar recordatorio',
    category: 'reminder',
    replacementMessage: 'Cancela el recordatorio, por favor.',
  },
}

export function buildActionId(key: string): string {
  return key.startsWith(ACTION_PREFIX) ? key : `${ACTION_PREFIX}${key}`
}

export function getActionDefinition(actionId: string | null | undefined): ActionDefinition | null {
  if (!actionId) return null
  return ACTIONS[actionId] ?? null
}

export function getScheduleButtons(): ActionDefinition[] {
  return [
    ACTIONS['action:schedule_confirm'],
    ACTIONS['action:schedule_reschedule'],
    ACTIONS['action:schedule_cancel'],
  ]
}

export function getReminderOptions(): ActionDefinition[] {
  return [
    ACTIONS['action:reminder_view'],
    ACTIONS['action:reminder_edit'],
    ACTIONS['action:reminder_cancel'],
  ]
}
