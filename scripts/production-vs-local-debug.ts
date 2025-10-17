/**
 * Production vs Local Environment Debug
 *
 * Helps identify differences between local (working) and production (failing) environments
 */

console.log(`
🔍 PRODUCTION vs LOCAL DEBUG ANALYSIS
=====================================

SUMMARY: Local environment works perfectly, production fails.
This indicates an environment configuration issue in Vercel.

📋 LOCAL ENVIRONMENT (✅ WORKING):
- ✅ Gemini responds: "¡Qué más parce! Todo bien..."
- ✅ All environment variables present
- ✅ Database accessible
- ✅ Free tier available (1,400 requests)
- ✅ Usage tracking functional

📋 PRODUCTION ENVIRONMENT (❌ FAILING):
- ❌ Bot responds: "Disculpa, tuve un problema al procesar tu mensaje"
- ❌ Error persists after multiple deployments
- ❌ Error comes from ai-processing-v2.ts:250 or gemini-agents.ts:347

🔧 REQUIRED ACTIONS (CRITICAL):

1. CHECK VERCEL ENVIRONMENT VARIABLES:

   Go to: https://vercel.com/neeroai/migue-ai/settings/environment-variables

   Verify these variables are SET and match local:

   ✅ GOOGLE_AI_API_KEY
   - Value should start with: AIzaSy...
   - Length: ~40 characters
   - Environment: Production ✓

   ✅ SUPABASE_KEY
   - Value should start with: eyJ...
   - Length: ~400+ characters
   - This MUST be the SERVICE_ROLE key (not anon key)
   - Environment: Production ✓

   ✅ SUPABASE_URL
   - Value: https://pdliixrgdvunoymxaxmw.supabase.co
   - Environment: Production ✓

   ❌ AI_EMERGENCY_STOP
   - Should NOT exist or be "false"
   - If it exists and is "true" → DELETE IT

2. CHECK DEPLOYMENT STATUS:

   Run: vercel ls --prod

   Look for:
   - Status: "READY" (not ERROR or BUILDING)
   - Recent deployment with commit: 060a885
   - Build successful

3. FORCE REDEPLOY (if needed):

   If variables are correct but still failing:
   - Go to Vercel Dashboard
   - Click "Redeploy" button
   - Wait 2-3 minutes
   - Test bot again

4. REAL-TIME LOG ANALYSIS:

   While testing the bot, run:
   vercel logs --prod --follow | grep -E "(error|gemini|AI|Disculpa)"

   Look for specific error patterns:
   - "GOOGLE_AI_API_KEY not set"
   - "Failed to check free tier"
   - "Emergency kill switch enabled"
   - Any Gemini-specific errors

5. TEST SEQUENCE:

   a) Fix Vercel environment variables
   b) Redeploy if necessary
   c) Send "hola" to WhatsApp bot
   d) Monitor logs in real-time
   e) Compare error with local success

==========================================

💡 MOST LIKELY CAUSES (ranked by probability):

1. 🥇 GOOGLE_AI_API_KEY missing/incorrect in Vercel
2. 🥈 SUPABASE_KEY is anon key instead of service_role key
3. 🥉 AI_EMERGENCY_STOP=true is blocking all requests
4. 🏅 Deployment didn't apply correctly (cache issue)

==========================================

🎯 EXPECTED RESOLUTION TIME: 5-10 minutes
Once environment variables are corrected, the bot should work immediately.

🔗 CRITICAL LINKS:
- Vercel Dashboard: https://vercel.com/neeroai/migue-ai
- Environment Variables: https://vercel.com/neeroai/migue-ai/settings/environment-variables
- Deployment History: https://vercel.com/neeroai/migue-ai/deployments
`);

// Show local environment for comparison
console.log('\n📋 Local Environment Variables (for reference):');
const localEnv = {
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  AI_EMERGENCY_STOP: process.env.AI_EMERGENCY_STOP,
};

Object.entries(localEnv).forEach(([key, value]) => {
  if (value) {
    const masked = key.includes('KEY') ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
    console.log(`✅ ${key}: ${masked}`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
});

console.log('\n🚨 ACTION REQUIRED: Check Vercel Dashboard NOW');
console.log('⏰ This issue should be resolved in < 10 minutes');