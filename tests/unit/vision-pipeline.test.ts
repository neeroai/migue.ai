import { classifyVisualInput } from '../../src/modules/ai/application/vision-pipeline'

describe('vision-pipeline classifyVisualInput', () => {
  it('classifies pdf as document text', () => {
    expect(classifyVisualInput('revisa esto', 'application/pdf')).toBe('DOCUMENT_TEXT')
  })

  it('classifies receipt by caption keywords', () => {
    expect(classifyVisualInput('esta es la factura del mercado', 'image/jpeg')).toBe('RECEIPT_INVOICE')
  })

  it('classifies id/form by caption keywords', () => {
    expect(classifyVisualInput('te mando mi cedula', 'image/jpeg')).toBe('ID_FORM')
  })

  it('falls back to general image classification', () => {
    expect(classifyVisualInput('mira esta foto', 'image/png')).toBe('GENERAL_IMAGE')
  })
})
