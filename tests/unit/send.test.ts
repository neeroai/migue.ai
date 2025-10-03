import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import * as sendModule from '../../lib/whatsapp'

const {
  sendWhatsAppText,
  sendTypingIndicator,
  createTypingManager,
  sendInteractiveButtons,
  sendInteractiveList,
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
    await sendTypingIndicator('+521234567890', 'typing')

    expect(fetch).toHaveBeenCalled()
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

  it('refreshes typing indicator until stopped', async () => {
    jest.useFakeTimers()
    const manager = createTypingManager('+521234567890')

    ;(fetch as jest.Mock).mockClear()
    await manager.start()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0]![1]!.body as string).typing.status).toBe('typing')

    ;(fetch as jest.Mock).mockClear()
    jest.advanceTimersByTime(7000)
    await Promise.resolve()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0]![1]!.body as string).typing.status).toBe('typing')

    ;(fetch as jest.Mock).mockClear()
    await manager.stop()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0]![1]!.body as string).typing.status).toBe('paused')

    ;(fetch as jest.Mock).mockClear()
    jest.advanceTimersByTime(7000)
    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
  })
})
