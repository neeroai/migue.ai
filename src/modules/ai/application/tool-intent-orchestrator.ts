import { processMessageWithAI } from './processing'

type ToolIntentParams = {
  conversationId: string
  userId: string
  userPhone: string
  userMessage: string
  messageId: string
}

export async function processToolIntent(params: ToolIntentParams): Promise<void> {
  await processMessageWithAI(
    params.conversationId,
    params.userId,
    params.userPhone,
    params.userMessage,
    params.messageId,
    { pathway: 'tool_intent' }
  )
}
