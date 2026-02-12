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
    delete process.env.FLOW_TEST_MODE_ENABLED;
    delete process.env.FLOW_TEST_TRANSFER_ID;
    process.env.NODE_ENV = 'test';
  });

  it('parses flow test command aliases', () => {
    expect(__testables.parseFlowKeyword('flow test transfer')).toEqual({
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
      expect.stringContaining('Disponibles: auth, signup, transfer')
    );
  });

  it('sends mapped testing flow with mock data for transfer', async () => {
    sendFlowMock.mockResolvedValue('wamid.flow');
    sendWhatsAppTextMock.mockResolvedValue('wamid.text');

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow test transfer',
      userId: 'u1',
      requestId: 'r1',
      conversationId: 'c1',
    });

    expect(handled).toBe(true);
    expect(sendFlowMock).toHaveBeenCalledWith(
      '+573001112233',
      'bank-transfer',
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

  it('respects explicit disable flag', async () => {
    process.env.FLOW_TEST_MODE_ENABLED = 'false';

    const handled = await tryHandleFlowTestingCommand({
      phoneNumber: '+573001112233',
      content: 'flow test transfer',
    });

    expect(handled).toBe(false);
    expect(sendFlowMock).not.toHaveBeenCalled();
    expect(sendWhatsAppTextMock).not.toHaveBeenCalled();
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
});
