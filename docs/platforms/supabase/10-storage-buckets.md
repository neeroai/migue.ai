# Storage Buckets

Supabase Storage for file uploads - planned feature for migue.ai.

## Overview

**Supabase Storage** provides S3-compatible object storage with CDN caching and RLS policies.

**migue.ai status**: 📅 **Planned** (not yet implemented)

**Planned buckets:**
- `audio-files` - WhatsApp voice messages
- `documents` - PDFs, images, videos from WhatsApp

**Current workaround**: Media URLs stored in `messages_v2.media_url` (WhatsApp CDN)

## Bucket Configuration

### Create Buckets

```sql
-- Via Supabase Dashboard → Storage
-- Or via SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audio-files', 'audio-files', false, 10485760, ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav']),  -- 10MB
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'video/mp4']);  -- 50MB
```

### Bucket Settings

| Bucket | Public | Max Size | MIME Types |
|--------|--------|----------|------------|
| `audio-files` | ❌ Private | 10MB | audio/ogg, audio/mpeg, audio/wav |
| `documents` | ❌ Private | 50MB | application/pdf, image/*, video/mp4 |

**Private buckets** require signed URLs → secure access with expiration.

## RLS Policies

### Users Can Read Own Files

```sql
-- Audio files policy
CREATE POLICY "Users can read own audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-files'
  AND auth.uid() IN (
    SELECT user_id FROM public.documents
    WHERE bucket = 'audio-files' AND path = name
  )
);

-- Documents policy
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IN (
    SELECT user_id FROM public.documents
    WHERE bucket = 'documents' AND path = name
  )
);
```

### Service Role Can Upload

```sql
-- Service role bypasses RLS (for webhook uploads)
-- No policy needed - use service role key
```

## TypeScript Integration

### Upload Audio File

```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

async function uploadAudioFile(params: {
  userId: string
  buffer: Buffer
  filename: string
  contentType: string
}): Promise<string> {
  const supabase = getSupabaseServerClient()

  // Upload to storage
  const path = `${params.userId}/${Date.now()}-${params.filename}`
  const { data, error } = await supabase.storage
    .from('audio-files')
    .upload(path, params.buffer, {
      contentType: params.contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Record in documents table
  await supabase.from('documents').insert({
    user_id: params.userId,
    bucket: 'audio-files',
    path: data.path,
    metadata: {
      original_filename: params.filename,
      content_type: params.contentType,
      size_bytes: params.buffer.length,
    },
  })

  // Return public URL
  const { data: urlData } = supabase.storage
    .from('audio-files')
    .getPublicUrl(data.path)

  return urlData.publicUrl
}
```

### Download with Signed URL

```typescript
async function getSignedAudioUrl(
  userId: string,
  path: string,
  expiresIn: number = 3600  // 1 hour
): Promise<string> {
  const supabase = getSupabaseServerClient()

  // Verify user owns file
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .eq('bucket', 'audio-files')
    .eq('path', path)
    .single()

  if (!doc) {
    throw new Error('File not found or access denied')
  }

  // Generate signed URL
  const { data, error } = await supabase.storage
    .from('audio-files')
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to generate URL: ${error.message}`)
  }

  return data.signedUrl
}
```

### Delete File

```typescript
async function deleteFile(userId: string, bucket: string, path: string): Promise<void> {
  const supabase = getSupabaseServerClient()

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (storageError) {
    throw new Error(`Storage delete failed: ${storageError.message}`)
  }

  // Delete from documents table
  await supabase.from('documents')
    .delete()
    .eq('user_id', userId)
    .eq('bucket', bucket)
    .eq('path', path)
}
```

## WhatsApp Media Integration

### Current Flow (No Storage)

```typescript
// app/api/whatsapp/webhook/route.ts
if (message.type === 'audio') {
  // WhatsApp provides CDN URL
  const mediaUrl = message.audio?.url

  // Store URL directly in messages_v2
  await supabase.from('messages_v2').insert({
    conversation_id,
    type: 'audio',
    media_url: mediaUrl,  // WhatsApp CDN
    timestamp: message.timestamp,
  })

  // Download and transcribe
  const audioBuffer = await downloadFromWhatsApp(mediaUrl)
  const transcript = await transcribeWithGroq(audioBuffer)
}
```

**Problem**: WhatsApp media URLs expire after ~30 days.

### Future Flow (With Storage)

```typescript
if (message.type === 'audio') {
  // Download from WhatsApp
  const audioBuffer = await downloadFromWhatsApp(message.audio.url)

  // Upload to Supabase Storage
  const storagePath = await uploadAudioFile({
    userId,
    buffer: audioBuffer,
    filename: `${message.id}.ogg`,
    contentType: 'audio/ogg',
  })

  // Store Supabase URL in messages_v2
  await supabase.from('messages_v2').insert({
    conversation_id,
    type: 'audio',
    media_url: `supabase://audio-files/${storagePath}`,  // Permanent
    timestamp: message.timestamp,
  })

  // Transcribe
  const transcript = await transcribeWithGroq(audioBuffer)
}
```

**Benefits**:
- Permanent storage (no expiration)
- Faster access (Supabase CDN)
- Backup of all media

## CDN Configuration

### Global CDN

**Supabase Storage includes Cloudflare CDN:**
- Edge caching worldwide
- Automatic image optimization
- Bandwidth: Included in pricing

### Cache Headers

```typescript
// Upload with cache headers
await supabase.storage.from('documents').upload(path, file, {
  cacheControl: '3600',  // 1 hour cache
  contentType: 'image/jpeg',
})
```

### Image Transformations

```typescript
// Get optimized image URL
const { data } = supabase.storage
  .from('documents')
  .getPublicUrl('user-id/photo.jpg', {
    transform: {
      width: 300,
      height: 300,
      resize: 'cover',
      quality: 80,
    },
  })
```

## Migration Plan

### Phase 1: Setup

1. Create buckets in Supabase Dashboard
2. Configure RLS policies
3. Update `documents` table constraints

### Phase 2: Webhook Integration

1. Download WhatsApp media on receipt
2. Upload to Supabase Storage
3. Store Supabase URL in `messages_v2`

### Phase 3: Historical Migration

```typescript
// Migrate existing WhatsApp URLs
async function migrateHistoricalMedia(): Promise<void> {
  const { data: messages } = await supabase
    .from('messages_v2')
    .select('*')
    .in('type', ['audio', 'image', 'video', 'document'])
    .like('media_url', 'https://mmg.whatsapp.net/%')  // WhatsApp CDN

  for (const msg of messages) {
    try {
      // Download from WhatsApp
      const buffer = await downloadFromWhatsApp(msg.media_url)

      // Upload to Supabase
      const path = await uploadToStorage(buffer, msg.type)

      // Update message
      await supabase.from('messages_v2')
        .update({ media_url: `supabase://${msg.type}-files/${path}` })
        .eq('id', msg.id)
    } catch (error) {
      console.error(`Failed to migrate ${msg.id}:`, error)
    }
  }
}
```

## Pricing

**Supabase Storage (Free Tier):**
- Storage: 1GB
- Bandwidth: 2GB/month
- Requests: 50K/month

**Pro Tier ($25/month):**
- Storage: 100GB
- Bandwidth: 200GB/month
- Requests: 2.5M/month

**migue.ai estimate (100 users, 10 audio msgs/day):**
- Audio files: ~1MB each × 1,000/month = 1GB storage ✅
- Bandwidth: 1GB download/month ✅
- **Fits in free tier**

## Common Pitfalls

### Pitfall 1: Missing Metadata

```typescript
// ❌ Bad: No metadata tracking
await supabase.storage.from('audio-files').upload(path, file)

// ✅ Good: Track in documents table
await supabase.from('documents').insert({
  user_id, bucket, path,
  metadata: { original_filename, size_bytes, content_type }
})
```

### Pitfall 2: Public Buckets

```typescript
// ❌ Bad: Public bucket exposes all files
CREATE BUCKET documents (public = true)

// ✅ Good: Private bucket + signed URLs
CREATE BUCKET documents (public = false)
const { signedUrl } = await supabase.storage.createSignedUrl(path, 3600)
```

### Pitfall 3: Large File Uploads

```typescript
// ❌ Bad: Load entire file into memory
const buffer = await readFileSync(path)
await supabase.storage.upload(path, buffer)

// ✅ Good: Stream large files
const stream = createReadStream(path)
await supabase.storage.upload(path, stream)
```

## Next Steps

- **[Database Schema](./02-database-schema.md)** - documents table reference
- **[RLS Security](./04-rls-security.md)** - Storage policies

## Resources

- **Official**: [Supabase Storage](https://supabase.com/docs/guides/storage)
- **Official**: [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control)

**Last Updated**: 2025-10-11
