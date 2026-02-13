import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const sendFlowMock = jest.fn();
const sendWhatsAppTextMock = jest.fn();

jest.mock('../../src/shared/infra/whatsapp', () => ({
  sendFlow: (...args: unknown[]) => sendFlowMock(...args),
  sendWhatsAppText: (...args: unknown[]) => sendWhatsAppTextMock(...args),
}));

import { __testables, tryHandleFlowTestingCommand } from '../../src/modules/flow-testing/application/service';

describe('flow testing service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FLOW_TEST_MODE_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
  });

  it('does not intercept commands when flow test mode is disabled', async () => {
    process.env.FLOW_TEST_MODE_ENABLED = 'false';

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow transferencia',
    });

    expect(handled).toBe(false);
    expect(sendFlowMock).not.toHaveBeenCalled();
    expect(sendWhatsAppTextMock).not.toHaveBeenCalled();
  });

  it('parses flow test command aliases', () => {
    expect(__testables.parseFlowKeyword('flow transferencia')).toEqual({
      flowKey: 'transfer',
      wantsHelp: false,
    });

    expect(__testables.parseFlowKeyword('prueba flujo deposito')).toEqual({
      flowKey: 'deposit',
      wantsHelp: false,
    });

    expect(__testables.parseFlowKeyword('flow test')).toEqual({
      flowKey: null,
      wantsHelp: true,
    });
  });

  it('sends help text when command requests options', async () => {
    sendWhatsAppTextMock.mockResolvedValue('wamid.help');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow test',
    });

    expect(handled).toBe(true);
    expect(sendFlowMock).not.toHaveBeenCalled();
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('Disponibles: auth, transfer')
    );
  });

  it('sends mapped testing flow with mock data for transfer', async () => {
    sendFlowMock.mockResolvedValue('wamid.flow');
    sendWhatsAppTextMock.mockResolvedValue('wamid.text');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow transferencia',
      userId: 'u1',
      requestId: 'r1',
      conversationId: 'c1',
    });

    expect(handled).toBe(true);
    expect(sendFlowMock).toHaveBeenCalledWith(
      '+573001112233',
      '1225081546379282',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        userId: 'u1',
        flowType: 'navigate',
        initialScreen: 'TRANSFER_AMOUNT',
        initialData: expect.objectContaining({
          balance: 1500000,
          currency: 'COP',
        }),
      })
    );
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('Te envie el flow de prueba')
    );
  });


  it('blocks signup flow command in test mode', async () => {
    sendWhatsAppTextMock.mockResolvedValue('wamid.text');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow signup',
    });

    expect(handled).toBe(true);
    expect(sendFlowMock).not.toHaveBeenCalled();
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('signup solo corre en onboarding real')
    );
  });

  it('returns handled with guidance when flow sending fails', async () => {
    sendFlowMock.mockResolvedValue(null);
    sendWhatsAppTextMock.mockResolvedValue('wamid.text');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow test balance',
    });

    expect(handled).toBe(true);
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('No pude enviar el flow de prueba')
    );
  });

  it('returns handled with guidance when flow sending throws', async () => {
    sendFlowMock.mockRejectedValue(new Error('Meta API timeout'));
    sendWhatsAppTextMock.mockResolvedValue('wamid.text');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow test transfer',
    });

    expect(handled).toBe(true);
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('No pude enviar el flow de prueba')
    );
  });
});
