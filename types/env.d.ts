declare namespace NodeJS {
  interface ProcessEnv {
    WHATSAPP_TOKEN: string;
    WHATSAPP_PHONE_ID: string;
    WHATSAPP_VERIFY_TOKEN: string;
    WHATSAPP_APP_SECRET: string;

    SUPABASE_URL: string;
    SUPABASE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    SUPABASE_ANON_KEY?: string;

    OPENAI_API_KEY: string;

    TIMEZONE?: string;
    NODE_ENV?: 'development' | 'test' | 'production';
    LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  }
}

export {};
