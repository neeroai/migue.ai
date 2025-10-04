# Audio Transcription Pipeline

## Overview
WhatsApp voice notes (`audio`/`voice`) now trigger an async pipeline that:
1. Downloads the media asset from the Graph API using the WhatsApp media ID.
2. Stores the original file inside the Supabase `audio-files` bucket under `userId/mediaId.ext`.
3. Sends the binary body to OpenAI Whisper (`gpt-4o-mini-transcribe`) for Spanish-first transcription.
4. Updates the original inbound message in `messages_v2` with the resulting text and storage URI.
5. Re-enters the AI responder using the transcription as the user message.

## Environment Requirements
- `WHATSAPP_TOKEN` with permissions to fetch media.
- `OPENAI_API_KEY` enabled for Whisper usage.
- Supabase service key (`SUPABASE_KEY`) with Storage access.

## Testing
Run unit tests with watchman disabled:

```bash
npx jest tests/unit --watchman=false
```

## Future Enhancements
- Redact PII before persisting transcriptions.
- Configurable retention policy for the `audio-files` bucket.
- Add streaming acknowledgement to the user while transcription runs.
