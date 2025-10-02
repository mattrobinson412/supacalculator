import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { service } = await req.json() // e.g., 'supabase-database', 'firebase-firestore'

    let pricing = {}

    // Fetch Supabase pricing (scrape or static)
    if (service === 'supabase-realtime') {
      pricing = {
        concurrent: { included: 500, overage: 10 / 1000 },
        messages: { included: 5000000, overage: 2.5 / 1000000 },
        maxSize: '3MB'
      }
    } // Add cases for other services/providers

    // For dynamic, use fetch to pricing pages
    // const supabaseRes = await fetch('https://supabase.com/pricing')
    // Parse HTML for latest (use DOM parser if needed)

    return new Response(
      JSON.stringify({ pricing }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: corsHeaders }
    )
  }
})