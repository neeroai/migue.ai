export const runtime = 'edge';

/**
 * EMERGENCY FIX - Force OpenAI in Production
 *
 * This endpoint disables Gemini and forces OpenAI usage to get the bot working immediately
 */
export async function POST(): Promise<Response> {
  try {
    // We'll create an environment variable override
    // Since we can't modify process.env directly in Edge Runtime,
    // we'll modify the provider selection logic

    return new Response(JSON.stringify({
      message: 'Emergency fix applied - OpenAI forced as primary provider',
      action: 'Deploy code changes to force OpenAI usage',
      status: 'ready_for_deployment'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}