import { processMessageWithAI } from './processing'

type TextFastPathParams = {
  conversationId: string
  userId: string
  userPhone: string
  userMessage: string
  messageId: string
}

export async function processTextFastPath(params: TextFastPathParams): Promise<void> {
  await processMessageWithAI(
    params.conversationId,
    params.userId,
    params.userPhone,
    params.userMessage,
    params.messageId,
    { pathway: 'fast_text' }
  )
}
