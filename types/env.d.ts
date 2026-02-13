declare namespace NodeJS {
  interface ProcessEnv {
    WHATSAPP_TOKEN: string;
    WHATSAPP_PHONE_ID: string;
    WHATSAPP_VERIFY_TOKEN: string;
    WHATSAPP_APP_SECRET: string;
    WHATSAPP_FLOW_PRIVATE_KEY?: string;
    WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE?: string;

    SUPABASE_URL: string;
    SUPABASE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_ANON_KEY?: string;

    OPENAI_API_KEY: string;

    TIMEZONE?: string;
    NODE_ENV?: 'development' | 'test' | 'production';
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
    AGENT_EVENT_LEDGER_ENABLED?: string;
    LEGACY_ROUTING_ENABLED?: string;
    WEB_SEARCH_ENABLED?: string;
    SIGNUP_FLOW_ENABLED?: string;
    SIGNUP_FLOW_ID?: string;
  }
}

export {};
