/**
 * Check Deployment Status & Debug Production Issues
 *
 * This script provides commands to monitor deployment and debug production issues
 */

console.log(`
🚀 Deployment Status & Debug Commands
====================================

1. Check Vercel Deployment Status:
   vercel ls --prod

2. Monitor Real-time Logs:
   vercel logs --prod --follow

3. Check Function Logs (after deployment):
   vercel logs --prod --since=5m | grep -E "(webhook|gemini|error|AI)"

4. Test WhatsApp Bot:
   Send "hola" to the bot and watch logs simultaneously

5. Look for these patterns in logs:

   ✅ GOOD PATTERNS:
   - "[gemini-client] Using Gemini (FREE tier)"
   - "[AI] Using Gemini with conversation history"
   - "GeminiProactiveAgent"
   - "[gemini-client] Free tier check" with "canUse": true

   ❌ BAD PATTERNS:
   - "GOOGLE_AI_API_KEY not set"
   - "Failed to check free tier"
   - "Emergency kill switch enabled"
   - "service_role_full_access" (should not appear after fix)
   - "canUseFreeTier() failed"

6. If still broken, check specific issues:

   A) Environment Variables Missing:
      → Go to Vercel Dashboard → Settings → Environment Variables
      → Verify GOOGLE_AI_API_KEY exists and is not empty
      → Verify SUPABASE_KEY is service_role key (~400 chars)
      → Delete AI_EMERGENCY_STOP if it exists

   B) RLS Policy Issues:
      → Run: npx dotenv-cli -e .env.local -- npx tsx scripts/verify-gemini-rls-fix.ts
      → Should show "Free tier check passed: true"

   C) Code Not Updated:
      → Check commit hash: git log -1 --oneline
      → Should show: "fix: apply RLS policy cleanup and add debug tools"

   D) Deployment Failed:
      → Check: vercel ls --prod
      → Look for "ERROR" status or failed builds

7. Emergency Actions:

   If urgent, disable AI temporarily:
   → Vercel Dashboard → Environment Variables
   → Add: AI_EMERGENCY_STOP = true
   → Bot will respond: "Sistema en mantenimiento..."

8. Expected Timeline:
   → Deployment: 2-3 minutes
   → Test message: Should work immediately after deployment
   → Expected response: "¡Qué más parce! Todo bien por acá..."

9. Next Steps After Fix:
   → Test with various messages
   → Monitor daily Gemini usage (should stay under 1,400 req/day)
   → Verify fallback to GPT-4o-mini works if Gemini limit reached

====================================
Current Status: Deployment in progress...
Next: Wait 3 minutes, then test bot with "hola"
`);

// Check if we can determine deployment status
const timestamp = new Date().toISOString();
console.log(`\n📋 Debug Session Info:`);
console.log(`Time: ${timestamp}`);
console.log(`Commit: ${process.env.VERCEL_GIT_COMMIT_SHA || 'Local development'}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`\n🔗 Useful Links:`);
console.log(`Production URL: https://migue.app`);
console.log(`Vercel Dashboard: https://vercel.com/neeroai/migue-ai`);
console.log(`Supabase Dashboard: https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw`);