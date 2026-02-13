import { sendFlow, sendWhatsAppText } from '../../../shared/infra/whatsapp';
import { logger } from '../../../shared/observability/logger';

type SupportedFlowKey =
  | 'auth'
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'kyc'
  | 'balance'
  | 'history';

type FlowTestConfig = {
  key: SupportedFlowKey;
  id: string;
  label: string;
  cta: string;
  body: string;
  initialScreen: string;
  initialData?: Record<string, unknown>;
};

const FLOW_ALIASES: Record<string, SupportedFlowKey> = {
  auth: 'auth',
  autenticacion: 'auth',
  pin: 'auth',

  transfer: 'transfer',
  transferencia: 'transfer',

  deposit: 'deposit',
  deposito: 'deposit',

  withdrawal: 'withdrawal',
  retiro: 'withdrawal',
  retirar: 'withdrawal',

  kyc: 'kyc',
  verificacion: 'kyc',

  balance: 'balance',
  saldo: 'balance',

  history: 'history',
  historial: 'history',
  movimientos: 'history',
};

const BLOCKED_FLOW_ALIASES = new Set(['signup', 'registro', 'onboarding']);

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseBoolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function isFlowTestingEnabled(): boolean {
  return parseBoolEnv(process.env.FLOW_TEST_MODE_ENABLED);
}

// Hardcoded on purpose: private QA flows without extra env configuration.
const FLOW_TEST_IDS: Record<SupportedFlowKey, string> = {
  auth: '909795558106175',
  transfer: '1225081546379282',
  deposit: '1436369834555180',
  withdrawal: '26051347737886658',
  kyc: '1604339393935363',
  balance: '1989322701981707',
  history: 'transaction-history',
};

function getFlowId(key: SupportedFlowKey): string {
  return FLOW_TEST_IDS[key];
}

function buildFlowConfig(key: SupportedFlowKey): FlowTestConfig {
  const flowId = getFlowId(key);

  switch (key) {
    case 'auth':
      return {
        key,
        id: flowId,
        label: 'Autenticacion PIN',
        cta: 'Probar Auth',
        body: 'Flow de prueba: autenticacion por PIN.',
        initialScreen: 'AUTH_SCREEN',
        initialData: {
          pin_label: 'Ingresa tu PIN de 4 digitos',
          helper_text: 'Modo prueba con datos mock.',
        },
      };
    case 'transfer':
      return {
        key,
        id: flowId,
        label: 'Transferencia',
        cta: 'Probar Transferencia',
        body: 'Flow de prueba: transferencia bancaria con datos mock.',
        initialScreen: 'TRANSFER_AMOUNT',
        initialData: {
          balance: 1500000,
          currency: 'COP',
          min_amount: 1000,
          max_amount: 10000000,
        },
      };
    case 'deposit':
      return {
        key,
        id: flowId,
        label: 'Deposito',
        cta: 'Probar Deposito',
        body: 'Flow de prueba: deposito con datos mock.',
        initialScreen: 'SELECT_METHOD',
      };
    case 'withdrawal':
      return {
        key,
        id: flowId,
        label: 'Retiro',
        cta: 'Probar Retiro',
        body: 'Flow de prueba: retiro con datos mock.',
        initialScreen: 'SELECT_METHOD',
        initialData: {
          balance: 1500000,
        },
      };
    case 'kyc':
      return {
        key,
        id: flowId,
        label: 'KYC',
        cta: 'Probar KYC',
        body: 'Flow de prueba: verificacion KYC con datos mock.',
        initialScreen: 'WELCOME',
      };
    case 'balance':
      return {
        key,
        id: flowId,
        label: 'Consulta saldo',
        cta: 'Probar Saldo',
        body: 'Flow de prueba: consulta de saldo con datos mock.',
        initialScreen: 'BALANCE_VIEW',
        initialData: {
          account_info: {
            balance: 1500000,
            available_balance: 1450000,
            held_balance: 50000,
            currency: 'COP',
            account_number: '****1234',
            account_holder: 'Usuario Prueba',
            last_update: '2026-02-12 12:00',
          },
          quick_actions: [
            { id: 'transfer', title: 'Transferir' },
            { id: 'deposit', title: 'Depositar' },
            { id: 'withdraw', title: 'Retirar' },
            { id: 'history', title: 'Movimientos' },
          ],
        },
      };
    case 'history':
      return {
        key,
        id: flowId,
        label: 'Historial transacciones',
        cta: 'Probar Historial',
        body: 'Flow de prueba: historial de transacciones con datos mock.',
        initialScreen: 'FILTER_OPTIONS',
        initialData: {
          date_ranges: [
            { id: '7days', title: 'Ultimos 7 dias' },
            { id: '30days', title: 'Ultimos 30 dias' },
            { id: '90days', title: 'Ultimos 3 meses' },
            { id: 'custom', title: 'Rango personalizado' },
          ],
          transaction_types: [
            { id: 'all', title: 'Todas' },
            { id: 'income', title: 'Ingresos' },
            { id: 'expense', title: 'Egresos' },
            { id: 'transfer', title: 'Transferencias' },
          ],
        },
      };
  }
}

function extractRequestedFlowAlias(content: string): string | null {
  const normalized = normalizeToken(content);
  const compact = normalized.replace(/\s+/g, ' ').trim();

  const direct = compact.match(/^(?:flow|flujo)\s+([a-z0-9_-]+)$/);
  if (direct?.[1]) return direct[1];

  const legacy = compact.match(/^(?:flow|flujo)\s+(?:test|prueba|testing)\s+([a-z0-9_-]+)$/);
  if (legacy?.[1]) return legacy[1];

  const reverse = compact.match(/^(?:test|prueba|testing)\s+(?:flow|flujo)\s+([a-z0-9_-]+)$/);
  if (reverse?.[1]) return reverse[1];

  return null;
}

function parseFlowKeyword(content: string): { flowKey: SupportedFlowKey | null; wantsHelp: boolean } {
  const normalized = normalizeToken(content);
  const compact = normalized.replace(/\s+/g, ' ').trim();

  const helpPatterns = ['flow test', 'test flow', 'flujo test', 'test flujo', 'flow', 'flujo'];
  if (helpPatterns.includes(compact)) {
    return { flowKey: null, wantsHelp: true };
  }

  const alias = extractRequestedFlowAlias(content);
  if (alias) {
    return { flowKey: FLOW_ALIASES[alias] ?? null, wantsHelp: false };
  }

  return { flowKey: null, wantsHelp: false };
}

async function sendHelpMessage(phoneNumber: string): Promise<void> {
  const help = [
    'Modo pruebas de flows activo.',
    'Usa: flow <nombre>.',
    'Disponibles: auth, transfer, deposit, withdrawal, kyc, balance, history.',
    'Ejemplo: flow transferencia',
  ].join('\n');

  await sendWhatsAppText(phoneNumber, help);
}

export async function tryHandleFlowTestingCommand(params: {
  phoneNumber: string;
  content: string | null;
  userId?: string;
  requestId?: string;
  conversationId?: string;
}): Promise<boolean> {
  if (!isFlowTestingEnabled()) return false;
  if (!params.content) return false;

  const requestedAlias = extractRequestedFlowAlias(params.content);
  if (requestedAlias && BLOCKED_FLOW_ALIASES.has(requestedAlias)) {
    await sendWhatsAppText(
      params.phoneNumber,
      'El flow de signup solo corre en onboarding real y no esta habilitado en modo test.'
    );
    return true;
  }

  const { flowKey, wantsHelp } = parseFlowKeyword(params.content);
  if (!flowKey && !wantsHelp) return false;

  if (wantsHelp) {
    await sendHelpMessage(params.phoneNumber);
    return true;
  }

  if (!flowKey) {
    await sendWhatsAppText(params.phoneNumber, 'No reconoci el flow. Escribe "flow test" para ver opciones.');
    return true;
  }

  const flow = buildFlowConfig(flowKey);

  const flowOptions = {
    flowType: 'navigate' as const,
    initialScreen: flow.initialScreen,
    ...(flow.initialData ? { initialData: flow.initialData } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
    expiresInMinutes: 120,
  };

  let messageId: string | null = null;
  try {
    messageId = await sendFlow(
      params.phoneNumber,
      flow.id,
      flow.cta,
      flow.body,
      flowOptions
    );
  } catch (error) {
    logger.warn('[flow-testing] Exception while sending testing flow', {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      metadata: {
        flowKey,
        flowId: flow.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
  }

  if (!messageId) {
    logger.warn('[flow-testing] Failed to send testing flow', {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      metadata: { flowKey, flowId: flow.id },
    });
    await sendWhatsAppText(
      params.phoneNumber,
      `No pude enviar el flow de prueba "${flow.label}". Revisa que el flow_id este publicado en Meta.`
    );
    return true;
  }

  await sendWhatsAppText(
    params.phoneNumber,
    `Listo. Te envie el flow de prueba "${flow.label}" con data mock.`
  );

  logger.info('[flow-testing] Testing flow sent by keyword', {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
    metadata: { flowKey, flowId: flow.id, messageId },
  });

  return true;
}

export const __testables = {
  parseFlowKeyword,
  buildFlowConfig,
  extractRequestedFlowAlias,
  parseBoolEnv,
  isFlowTestingEnabled,
};
