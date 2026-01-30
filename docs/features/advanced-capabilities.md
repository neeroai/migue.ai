---
title: "Advanced Capabilities"
summary: "Media processing, OCR, voice transcription, location/timezone, language detection"
description: "Media pipeline (audio/image/document), Whisper transcription, Tesseract OCR, location detection, timezone handling, language detection with FastText, and rich media templates"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Features"
---

# Advanced Capabilities

## Media Processing Pipeline

| Type | Steps | Latency | Cost | Cache Strategy | Max Size |
|------|-------|---------|------|----------------|----------|
| Audio | Download → Whisper → Store | 3-8s | $0.006/min | 24h | 16 MB |
| Image | Download → OCR → Extract | 2-4s | $0.001/image | 7d | 5 MB |
| Document | Download → OCR → Parse | 3-6s | $0.002/page | 7d | 100 MB |
| Video | Download → Extract frame → OCR | 4-8s | $0.003/frame | None | 16 MB |
| Sticker | Download → Store | 1s | Free | 30d | 500 KB |

**Processing flow**:
1. Receive media webhook
2. Download from WhatsApp CDN (valid 24h)
3. Process based on type
4. Cache result in Supabase Storage
5. Store metadata in messages table
6. Return extracted data to agent

**Storage structure**:
```
supabase-storage/
├── audio/
│   └── {user_id}/{message_id}.ogg
├── images/
│   └── {user_id}/{message_id}.jpg
├── documents/
│   └── {user_id}/{message_id}.pdf
└── extracted/
    └── {message_id}.json  # OCR/transcription results
```

---

## OCR Extraction Patterns

| Document Type | Fields | Accuracy | Validation | Example |
|---------------|--------|----------|------------|---------|
| Receipt | amount, merchant, date, items | 90% | Amount format, date parse | $45.99, Starbucks, 2026-01-29 |
| Invoice | total, invoice_number, date, vendor | 85% | Invoice format, number pattern | INV-12345, $1,234.56 |
| Business card | name, phone, email, company | 80% | Email regex, phone format | John Doe, +57 123 4567890 |
| ID card | name, id_number, expiry | 75% | ID format, date validation | Juan Pérez, CC 123456789 |
| Menu | items, prices | 70% | Price format | Burger $12, Fries $5 |

**OCR implementation** (Tesseract):
```typescript
import Tesseract from 'tesseract.js';

async function extractTextFromImage(
  imageUrl: string,
  documentType?: string
): Promise<OCRResult> {
  // Download image
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();

  // OCR with language hint
  const { data } = await Tesseract.recognize(buffer, 'eng+spa', {
    logger: info => console.log(info)
  });

  // Extract structured data based on type
  if (documentType === 'receipt') {
    return extractReceiptData(data.text);
  } else if (documentType === 'invoice') {
    return extractInvoiceData(data.text);
  }

  return { text: data.text, confidence: data.confidence };
}

function extractReceiptData(text: string): ReceiptData {
  // Extract amount (last number usually)
  const amounts = text.match(/\$?\d+\.\d{2}/g) || [];
  const total = amounts[amounts.length - 1];

  // Extract date
  const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  const date = dateMatch ? parseDate(dateMatch[0]) : null;

  // Extract merchant (first line usually)
  const lines = text.split('\n').filter(l => l.trim());
  const merchant = lines[0];

  return {
    amount: parseFloat(total?.replace('$', '') || '0'),
    merchant,
    date,
    confidence: 0.85
  };
}
```

---

## Whisper Transcription Pipeline

| Language | Model | Latency | Cost | Accuracy | Use Case |
|----------|-------|---------|------|----------|----------|
| Spanish | whisper-1 | 3-5s | $0.006/min | 95% | Primary |
| English | whisper-1 | 3-5s | $0.006/min | 97% | Secondary |
| Auto-detect | whisper-1 | 3-5s | $0.006/min | 93% | Mixed language |

**Transcription flow**:
```typescript
async function transcribeAudio(
  audioUrl: string,
  language?: string
): Promise<TranscriptionResult> {
  // 1. Download audio
  const response = await fetch(audioUrl);
  const audioBuffer = await response.arrayBuffer();

  // 2. Convert to supported format if needed (OGG → MP3)
  const converted = await convertAudio(audioBuffer, 'mp3');

  // 3. Call Whisper API
  const transcription = await openai.audio.transcriptions.create({
    file: new File([converted], 'audio.mp3', { type: 'audio/mp3' }),
    model: 'whisper-1',
    language: language || undefined, // Auto-detect if not specified
    response_format: 'verbose_json'
  });

  // 4. Extract metadata
  return {
    text: transcription.text,
    language: transcription.language,
    duration: transcription.duration,
    confidence: calculateConfidence(transcription),
    segments: transcription.segments
  };
}

// Confidence calculation from segment probabilities
function calculateConfidence(result: any): number {
  if (!result.segments || result.segments.length === 0) return 0.8;

  const avgProb = result.segments.reduce(
    (sum: number, seg: any) => sum + (seg.avg_logprob || 0),
    0
  ) / result.segments.length;

  // Convert log probability to confidence (0-1)
  return Math.min(Math.exp(avgProb), 1);
}
```

---

## Location Detection Methods

| Source | Accuracy | Fallback | Confidence | Example |
|--------|----------|----------|------------|---------|
| GPS coordinates | ±10m | None | 1.0 | "13.4,-74.3" → Exact location |
| Named location | ±100m | Geocoding API | 0.9 | "Parque 93, Bogotá" |
| Address | ±50m | Geocoding API | 0.85 | "Calle 100 #15-20" |
| City name | ±5km | Country center | 0.7 | "Bogotá" → City center |
| Implicit | Variable | None | 0.5 | "cerca del aeropuerto" |

**Location extraction**:
```typescript
async function extractLocation(
  text: string,
  context: Context
): Promise<LocationResult> {
  // 1. Check for GPS coordinates
  const coordMatch = text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2]),
      confidence: 1.0,
      source: 'gps'
    };
  }

  // 2. Named entity recognition for locations
  const locations = await extractLocationEntities(text);
  if (locations.length > 0) {
    const geocoded = await geocodeLocation(locations[0]);
    return {
      ...geocoded,
      confidence: 0.9,
      source: 'named'
    };
  }

  // 3. Use context (user's last known location)
  if (context.lastLocation) {
    return {
      ...context.lastLocation,
      confidence: 0.5,
      source: 'context'
    };
  }

  return { confidence: 0, source: 'none' };
}
```

---

## Timezone Handling

| Input | Detection Method | Confidence | Output | Example |
|-------|------------------|------------|--------|---------|
| Explicit | Parse timezone string | 1.0 | IANA timezone | "America/Bogota" |
| Location | Lat/lng → timezone | 0.95 | IANA timezone | (4.6, -74.0) → America/Bogota |
| City name | City → timezone | 0.9 | IANA timezone | "Bogotá" → America/Bogota |
| User profile | Stored preference | 0.85 | IANA timezone | From user_memory |
| Phone prefix | +57 → Colombia | 0.7 | Default timezone | +57 → America/Bogota |

**Timezone detection**:
```typescript
import { getTimezone } from 'countries-and-timezones';

async function detectTimezone(
  location?: { lat: number; lng: number },
  userId?: string
): Promise<string> {
  // 1. Check user preference
  if (userId) {
    const preference = await getUserPreference(userId, 'timezone');
    if (preference) return preference;
  }

  // 2. Use location
  if (location) {
    const tz = await getTimezoneFromCoordinates(location.lat, location.lng);
    if (tz) return tz;
  }

  // 3. Default to Colombia (primary market)
  return 'America/Bogota';
}

// Convert user-friendly time to UTC
function toUTC(
  localTime: string,
  timezone: string
): Date {
  const dt = DateTime.fromISO(localTime, { zone: timezone });
  return dt.toUTC().toJSDate();
}

// Convert UTC to user timezone
function toLocalTime(
  utcDate: Date,
  timezone: string
): string {
  return DateTime.fromJSDate(utcDate)
    .setZone(timezone)
    .toLocaleString(DateTime.DATETIME_FULL);
}
```

---

## Language Detection Matrix

| Language | Variant | Detection Method | Confidence Threshold | Example |
|----------|---------|------------------|---------------------|---------|
| Spanish | LATAM | FastText | 0.85 | "Hola, ¿cómo estás?" |
| Spanish | Spain | FastText + patterns | 0.80 | "Hola, ¿qué tal?" (vosotros) |
| English | US | FastText | 0.85 | "Hello, how are you?" |
| Portuguese | Brazil | FastText | 0.80 | "Olá, tudo bem?" |
| Mixed | ES+EN | Multilingual detection | 0.70 | "Hola, I need help" |

**Language detection**:
```typescript
import { franc } from 'franc';

async function detectLanguage(
  text: string,
  context?: Context
): Promise<LanguageResult> {
  // 1. Use language detector
  const detected = franc(text, { minLength: 10 });

  // 2. Map ISO 639-3 to ISO 639-1
  const language = ISO_639_3_TO_1[detected] || 'es';

  // 3. Determine confidence
  const confidence = calculateLanguageConfidence(text, language);

  // 4. Use context if low confidence
  if (confidence < 0.7 && context?.preferredLanguage) {
    return {
      language: context.preferredLanguage,
      confidence: 0.6,
      source: 'context'
    };
  }

  return {
    language,
    confidence,
    source: 'detected'
  };
}

// Store language preference
async function updateLanguagePreference(
  userId: string,
  language: string
): Promise<void> {
  await supabase.from('user_memory').upsert({
    user_id: userId,
    memory_type: 'preference',
    content: `Preferred language: ${language}`,
    confidence: 1.0
  });
}
```

---

## Rich Media Templates

| Template Type | Use Case | Generation Time | File Size | Format |
|---------------|----------|----------------|-----------|--------|
| QR code | Event tickets, payments | 100ms | <10 KB | PNG |
| Calendar image | Schedule visualization | 200ms | <50 KB | PNG |
| Chart | Expense summaries | 300ms | <100 KB | PNG |
| Map | Location sharing | 400ms | <200 KB | PNG |
| Receipt | Expense confirmation | 150ms | <50 KB | PDF |

**QR code generation**:
```typescript
import QRCode from 'qrcode';

async function generateQRCode(data: string): Promise<Buffer> {
  return await QRCode.toBuffer(data, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 400,
    margin: 2
  });
}

// Usage: Generate payment QR
async function sendPaymentQR(
  phoneNumber: string,
  amount: number,
  reference: string
): Promise<void> {
  const qrData = `PAY:${amount}:${reference}`;
  const qrBuffer = await generateQRCode(qrData);

  await sendImageMessage(phoneNumber, qrBuffer, {
    caption: `Payment QR: $${amount}\nRef: ${reference}`
  });
}
```

---

## Citations

- **WhatsApp expert output**: Media handling and advanced features
- **molbot media/ + media-understanding/**: Media processing patterns
- **PRD Section 4.6**: Voice message transcription
- **PRD Section 4.7**: Location and timezone handling
- **Archived lib/tesseract-ocr.ts**: OCR implementation

---

**Lines**: 278 | **Tokens**: ~834
