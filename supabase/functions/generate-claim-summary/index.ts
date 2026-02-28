import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { claimId } = await req.json();

    if (!claimId) {
      return new Response(
        JSON.stringify({ error: "Claim ID is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("OpenAI API key not configured");
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured",
          summary: "[AI summary unavailable - API key not configured]"
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch claim data
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      return new Response(
        JSON.stringify({ error: "Claim not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Build context for AI summary
    const context = `
Incident Type: ${claim.incident_type || 'Not specified'}
Location: ${claim.location || 'Not specified'}
Vehicle Condition: ${claim.car_condition || 'Not specified'}
Date: ${claim.accident_date_time || 'Not specified'}

Voice Statement:
${claim.voice_transcript || 'No voice statement'}

Additional Data:
${JSON.stringify(claim.claim_data || {}, null, 2)}

Claimant Name: ${claim.claimant_name || 'Not specified'}
Policy Number: ${claim.policy_number || 'Not specified'}
    `.trim();

    // Call OpenAI to generate summary
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an insurance claims assistant. Write concise professional summaries for brokers. Focus on the key facts: what happened, where, when, and what damages occurred. Keep it to 3-4 sentences maximum. Use clear, professional language suitable for insurance brokers."
          },
          {
            role: "user",
            content: `Summarize this insurance claim in 3-4 sentences:\n\n${context}`
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errorText);

      return new Response(
        JSON.stringify({
          error: `AI service error (${aiResponse.status})`,
          summary: "[AI summary unavailable - please check API configuration]"
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices[0]?.message?.content || "[Summary generation failed]";

    // Update claim with AI summary
    const { error: updateError } = await supabase
      .from("claims")
      .update({ ai_summary: summary })
      .eq("id", claimId);

    if (updateError) {
      console.error("Failed to update claim with summary:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to save summary",
          summary
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ summary }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Summary generation error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        summary: "[Summary generation failed]"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
