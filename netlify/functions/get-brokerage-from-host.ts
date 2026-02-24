import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const host = event.headers.host || event.headers['x-forwarded-host'] || '';

    console.log('🌐 Host detection:', host);

    let subdomain: string | null = null;

    if (host.endsWith('.claimsportal.co.za')) {
      subdomain = host.split('.')[0];
      console.log('📍 Subdomain detected:', subdomain);
    } else {
      console.log('📍 No subdomain detected (platform domain)');
    }

    if (!subdomain) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, isPlatform: true }),
      };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: brokerage, error: dbError } = await supabase
      .from('brokerages')
      .select('id, name, slug, signup_code, subdomain, brand_color, notification_email')
      .or(`signup_code.eq.${subdomain},slug.eq.${subdomain},subdomain.eq.${subdomain}`)
      .maybeSingle();

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    if (!brokerage) {
      console.log('⚠️ No brokerage found for subdomain:', subdomain);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, isPlatform: true }),
      };
    }

    console.log('✓ Brokerage found:', brokerage.name);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, brokerage }),
    };
  } catch (error) {
    console.error('Error in get-brokerage-from-host:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};

export { handler };
