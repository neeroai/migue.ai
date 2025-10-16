/**
 * Debug Production Environment Variables
 *
 * This script helps verify that all required environment variables
 * are properly configured in Vercel production environment.
 *
 * Usage: Run this script to get verification commands for Vercel Dashboard
 */

console.log(`
🔍 Production Environment Debugging Guide
==========================================

Follow these steps to verify Vercel environment variables:

1. Open Vercel Dashboard:
   https://vercel.com/neeroai/migue-ai/settings/environment-variables

2. Verify these CRITICAL variables exist and have correct values:

   ✅ GOOGLE_AI_API_KEY
   - Should start with: AIzaSy...
   - Length: ~40 characters
   - Status: Should NOT be empty

   ✅ SUPABASE_KEY
   - Should start with: eyJ...
   - This should be the SERVICE_ROLE key (NOT anon key)
   - Length: ~400+ characters

   ✅ SUPABASE_URL
   - Should be: https://pdliixrgdvunoymxaxmw.supabase.co

   ❌ AI_EMERGENCY_STOP
   - Should NOT exist or be set to "false"
   - If exists and set to "true" → DELETE IT

3. Check these optional variables:

   OPENAI_API_KEY (fallback): sk-proj-...
   ANTHROPIC_API_KEY (emergency): sk-ant-...
   WHATSAPP_TOKEN: EAAOz1DTH2psBPp...

4. After verifying/fixing environment variables:
   - Click "Redeploy" button in Vercel Dashboard
   - OR push any commit to trigger deployment

5. Test the bot:
   Send "hola" to your WhatsApp bot number

Expected Response Examples:
✅ WORKING: "¡Qué más parce! Todo bien por acá. ¿En qué te ayudo?"
❌ BROKEN: "Disculpa, tuve un problema al procesar tu mensaje..."

6. If still broken, check Vercel Function Logs:
   vercel logs --prod --follow

Look for these log patterns:
✅ GOOD: "[gemini-client] Using Gemini (FREE tier)"
❌ BAD: "GOOGLE_AI_API_KEY not set"
❌ BAD: "Failed to check free tier"
❌ BAD: "Emergency kill switch enabled"

==========================================
Next Steps After Environment Check:
1. If environment is correct → Test bot
2. If bot still fails → Run: npm run debug:production
3. If urgent → Set AI_EMERGENCY_STOP=true to disable AI
`);

// Also check local environment for comparison
console.log('\n📋 Local Environment Check (for comparison):');
console.log('===========================================');

const envVars = [
  'GOOGLE_AI_API_KEY',
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'AI_EMERGENCY_STOP'
];

envVars.forEach(key => {
  const value = process.env[key];
  if (value) {
    const masked = key.includes('KEY') ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
    console.log(`✅ ${key}: ${masked}`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
});

console.log('\n🚀 Ready to test? Send "hola" to the bot now!');