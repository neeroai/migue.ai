import crypto from 'crypto'

type EncryptedFlowRequest = {
  encrypted_flow_data: string
  encrypted_aes_key: string
  initial_vector: string
}

type DecryptedFlowPayload = {
  payload: any
  aesKey: Buffer
  iv: Buffer
}

function normalizePem(input: string): string {
  return input.includes('\\n') ? input.replace(/\\n/g, '\n') : input
}

function resolveCipherAlgorithm(aesKey: Buffer): string {
  const bits = aesKey.length * 8
  if (bits === 128 || bits === 192 || bits === 256) {
    return `aes-${bits}-gcm`
  }
  throw new Error(`Unsupported AES key length: ${aesKey.length}`)
}

export function decryptFlowRequest(body: EncryptedFlowRequest): DecryptedFlowPayload {
  const privateKeyPemRaw = process.env.WHATSAPP_FLOW_PRIVATE_KEY
  if (!privateKeyPemRaw) {
    throw new Error('Missing WHATSAPP_FLOW_PRIVATE_KEY')
  }

  const privateKeyPem = normalizePem(privateKeyPemRaw)
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    passphrase: process.env.WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE,
  })

  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, 'base64')
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  )

  const iv = Buffer.from(body.initial_vector, 'base64')
  const encryptedPayload = Buffer.from(body.encrypted_flow_data, 'base64')
  const ciphertext = encryptedPayload.subarray(0, encryptedPayload.length - 16)
  const authTag = encryptedPayload.subarray(encryptedPayload.length - 16)

  const decipher = crypto.createDecipheriv(resolveCipherAlgorithm(aesKey), aesKey, iv) as any
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const payload = JSON.parse(plaintext.toString('utf8'))

  return { payload, aesKey, iv }
}

export function encryptFlowResponse(responsePayload: unknown, aesKey: Buffer, iv: Buffer): string {
  const flippedIv = Buffer.from(iv.map((byte) => byte ^ 0xff))
  const cipher = crypto.createCipheriv(resolveCipherAlgorithm(aesKey), aesKey, flippedIv) as any
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(responsePayload), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([ciphertext, authTag]).toString('base64')
}

export function isEncryptedFlowEnvelope(body: any): body is EncryptedFlowRequest {
  return !!(
    body &&
    typeof body.encrypted_flow_data === 'string' &&
    typeof body.encrypted_aes_key === 'string' &&
    typeof body.initial_vector === 'string'
  )
}
