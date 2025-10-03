const DEFAULT_MAX_CHARS = 1500
const OVERLAP_CHARS = 200

const WHITESPACE_REGEX = /\s+/g

export function normalizeText(input: string): string {
  return input.replace(WHITESPACE_REGEX, ' ').trim()
}

export function chunkText(
  text: string,
  options?: { maxChars?: number; overlap?: number }
): string[] {
  const clean = normalizeText(text)
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS
  const overlap = options?.overlap ?? OVERLAP_CHARS
  if (clean.length <= maxChars) {
    return [clean]
  }
  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    const end = Math.min(clean.length, start + maxChars)
    chunks.push(clean.slice(start, end))
    if (end === clean.length) break
    start = end - overlap
    if (start <= chunks[chunks.length - 1]!.length && start === 0) {
      start = end
    }
    if (start < 0) start = 0
  }
  return chunks
}
