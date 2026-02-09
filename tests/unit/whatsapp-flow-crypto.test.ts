import { beforeEach, describe, expect, it } from '@jest/globals'
import crypto from 'crypto'
import {
  decryptFlowRequest,
  encryptFlowResponse,
  isEncryptedFlowEnvelope,
} from '../../src/shared/infra/whatsapp/flow-crypto'

function buildEncryptedRequest(payload: Record<string, unknown>, publicKeyPem: string) {
  const aesKey = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const encryptedFlowData = Buffer.concat([ciphertext, tag]).toString('base64')

  const encryptedAesKey = crypto
    .publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    )
    .toString('base64')

  return {
    body: {
      encrypted_flow_data: encryptedFlowData,
      encrypted_aes_key: encryptedAesKey,
      initial_vector: iv.toString('base64'),
    },
    aesKey,
    iv,
  }
}

describe('whatsapp flow crypto', () => {
  let privateKeyPem = ''
  let publicKeyPem = ''

  beforeEach(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    privateKeyPem = privateKey
    publicKeyPem = publicKey
    process.env.WHATSAPP_FLOW_PRIVATE_KEY = privateKeyPem
  })

  it('detects encrypted flow envelope', () => {
    expect(isEncryptedFlowEnvelope({ encrypted_flow_data: 'a', encrypted_aes_key: 'b', initial_vector: 'c' })).toBe(true)
    expect(isEncryptedFlowEnvelope({ encrypted_flow_data: 'a' })).toBe(false)
  })

  it('decrypts request and encrypts response using same key context', () => {
    const originalPayload = { action: 'ping', version: '3.0', flow_token: 't1', screen: 'WELCOME', data: {} }
    const { body, aesKey, iv } = buildEncryptedRequest(originalPayload, publicKeyPem)

    const decrypted = decryptFlowRequest(body)
    expect(decrypted.payload.action).toBe('ping')
    expect(decrypted.aesKey.equals(aesKey)).toBe(true)

    const response = { version: '3.0', screen: 'SUCCESS', data: { status: 'active' } }
    const encryptedResponseB64 = encryptFlowResponse(response, decrypted.aesKey, decrypted.iv)
    expect(typeof encryptedResponseB64).toBe('string')
    expect(encryptedResponseB64.length).toBeGreaterThan(24)

    const encryptedResponse = Buffer.from(encryptedResponseB64, 'base64')
    const responseCiphertext = encryptedResponse.subarray(0, encryptedResponse.length - 16)
    const responseTag = encryptedResponse.subarray(encryptedResponse.length - 16)
    const flippedIv = Buffer.from(iv.map((byte) => byte ^ 0xff))
    const decipher = crypto.createDecipheriv('aes-128-gcm', aesKey, flippedIv)
    decipher.setAuthTag(responseTag)
    const plaintext = Buffer.concat([decipher.update(responseCiphertext), decipher.final()]).toString('utf8')

    expect(JSON.parse(plaintext)).toEqual(response)
  })
})

