export type ToolIntent = 'reminder' | 'schedule' | 'expense'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function detectToolIntents(text: string): ToolIntent[] {
  const raw = text.toLowerCase()
  const normalized = normalize(text)
  const source = `${raw}\n${normalized}`
  const intents: ToolIntent[] = []

  if (/recuerd|record|no olvid|avis|tengo que|debo|me recuerdas|recordar/.test(source)) {
    intents.push('reminder')
  }

  if (/agenda|agendar|reserva|reservar|programa|programar|reun|cita/.test(source)) {
    intents.push('schedule')
  }

  if (/gast|pague|pague|pagó|pago|compre|compr|costo|costó|sali|salio|me gaste|gasto/.test(source)) {
    intents.push('expense')
  }

  return intents
}

export function hasToolIntent(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false
  return detectToolIntents(text).length > 0
}
