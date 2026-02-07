import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import * as sendModule from '../../src/shared/infra/whatsapp'

const {
  sendWhatsAppText,
  createTypingManager,
  sendInteractiveButtons,
  sendInteractiveList,
  markAsReadWithTyping,
} = sendModule

describe('WhatsApp send helpers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, WHATSAPP_TOKEN: 'token', WHATSAPP_PHONE_ID: 'phone' }
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, messages: [{ id: 'msg-1' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    )
  })

  afterEach(() => {
    jest.useRealTimers()
    process.env = originalEnv
  })

  it('sends text messages', async () => {
    const id = await sendWhatsAppText('+521234567890', 'Hola')

    expect(id).toBe('msg-1')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/phone/messages'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when credentials missing', async () => {
    delete process.env.WHATSAPP_TOKEN
    await expect(sendWhatsAppText('+52', 'hola')).rejects.toThrow('Missing WhatsApp credentials')
  })

  it('supports typing indicator', async () => {
    await markAsReadWithTyping('+521234567890', 'wamid.test123')

    expect(fetch).toHaveBeenCalled()
    const call = (fetch as jest.Mock).mock.calls[0]!
    const body = JSON.parse(call[1]!.body as string)
    expect(body.status).toBe('read')
    expect(body.message_id).toBe('wamid.test123')
  })

  it('sends interactive buttons', async () => {
    ;(fetch as jest.Mock).mockClear()
    await sendInteractiveButtons('+521234567890', '¿Qué deseas hacer?', [
      { id: 'action:test_yes', title: 'Sí' },
      { id: 'action:test_no', title: 'No' },
    ])

    const call = (fetch as jest.Mock).mock.calls[0]!
    const body = JSON.parse(call[1]!.body as string)
    expect(body.interactive.type).toBe('button')
    expect(body.interactive.action.buttons).toHaveLength(2)
  })

  it('sends interactive list', async () => {
    ;(fetch as jest.Mock).mockClear()
    await sendInteractiveList(
      '+521234567890',
      'Elige una opción',
      'Seleccionar',
      [
        { id: 'row1', title: 'Ver', description: 'Ver recordatorios' },
        { id: 'row2', title: 'Editar' },
      ],
      'Acciones'
    )

    const call = (fetch as jest.Mock).mock.calls[0]!
    const body = JSON.parse(call[1]!.body as string)
    expect(body.interactive.type).toBe('list')
    expect(body.interactive.action.sections[0].rows).toHaveLength(2)
  })

  it('manages typing indicator state', async () => {
    jest.useFakeTimers()
    const manager = createTypingManager('+521234567890', 'wamid.test123')

    ;(fetch as jest.Mock).mockClear()
    await manager.start()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(manager.isActive()).toBe(true)

    const call = (fetch as jest.Mock).mock.calls[0]!
    const body = JSON.parse(call[1]!.body as string)
    expect(body.status).toBe('read')
    expect(body.message_id).toBe('wamid.test123')

    await manager.stop()
    expect(manager.isActive()).toBe(false)

    // Should not call API again when already stopped
    ;(fetch as jest.Mock).mockClear()
    jest.advanceTimersByTime(7000)
    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
  })
})
