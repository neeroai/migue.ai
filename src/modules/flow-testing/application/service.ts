import { sendFlow, sendWhatsAppText } from '../../../shared/infra/whatsapp';
import { logger } from '../../../shared/observability/logger';

type SupportedFlowKey =
  | 'auth'
  | 'signup'
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

  signup: 'signup',
  registro: 'signup',
  onboarding: 'signup',

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

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isFlowTestingEnabled(): boolean {
  const configured = process.env.FLOW_TEST_MODE_ENABLED?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function getFlowId(key: SupportedFlowKey): string {
  switch (key) {
    case 'auth':
      return process.env.FLOW_TEST_AUTH_ID?.trim() || 'auth-pin';
    case 'signup':
      return process.env.FLOW_TEST_SIGNUP_ID?.trim() || process.env.SIGNUP_FLOW_ID?.trim() || 'user-signup';
    case 'transfer':
      return process.env.FLOW_TEST_TRANSFER_ID?.trim() || 'bank-transfer';
    case 'deposit':
      return process.env.FLOW_TEST_DEPOSIT_ID?.trim() || 'deposit';
    case 'withdrawal':
      return process.env.FLOW_TEST_WITHDRAWAL_ID?.trim() || 'withdrawal';
    case 'kyc':
      return process.env.FLOW_TEST_KYC_ID?.trim() || 'kyc-verification';
    case 'balance':
      return process.env.FLOW_TEST_BALANCE_ID?.trim() || 'balance-check';
    case 'history':
      return process.env.FLOW_TEST_HISTORY_ID?.trim() || 'transaction-history';
    default:
      return key;
  }
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
    case 'signup':
      return {
        key,
        id: flowId,
        label: 'Registro usuario',
        cta: 'Probar Registro',
        body: 'Flow de prueba: registro de usuario con datos mock.',
        initialScreen: 'WELCOME',
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

function parseFlowKeyword(content: string): { flowKey: SupportedFlowKey | null; wantsHelp: boolean } {
  const normalized = normalizeToken(content);
  const compact = normalized.replace(/\s+/g, ' ').trim();

  const helpPatterns = ['flow test', 'test flow', 'flujo test', 'test flujo', 'flow', 'flujo'];
  if (helpPatterns.includes(compact)) {
    return { flowKey: null, wantsHelp: true };
  }

  const match = compact.match(/^(?:flow|flujo)\s+(?:test|prueba|testing)\s+([a-z0-9_-]+)$/);
  if (match?.[1]) {
    return { flowKey: FLOW_ALIASES[match[1]] ?? null, wantsHelp: false };
  }

  const reverseMatch = compact.match(/^(?:test|prueba|testing)\s+(?:flow|flujo)\s+([a-z0-9_-]+)$/);
  if (reverseMatch?.[1]) {
    return { flowKey: FLOW_ALIASES[reverseMatch[1]] ?? null, wantsHelp: false };
  }

  return { flowKey: null, wantsHelp: false };
}

async function sendHelpMessage(phoneNumber: string): Promise<void> {
  const help = [
    'Modo pruebas de flows activo.',
    'Usa: flow test <nombre>.',
    'Disponibles: auth, signup, transfer, deposit, withdrawal, kyc, balance, history.',
    'Ejemplo: flow test transfer',
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

  const messageId = await sendFlow(
    params.phoneNumber,
    flow.id,
    flow.cta,
    flow.body,
    flowOptions
  );

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
  isFlowTestingEnabled,
};
