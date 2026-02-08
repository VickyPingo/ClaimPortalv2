import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ error: "Audio URL is required" }),
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
      return new Response(
        JSON.stringify({
          error: "OpenAI API key not configured",
          transcript: "[Transcription unavailable - API key not configured]"
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

    const audioResponse = await fetch(audioUrl);
    const audioBlob = await audioResponse.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "af");
    formData.append("response_format", "text");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: formData,
      }
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", whisperResponse.status, errorText);

      return new Response(
        JSON.stringify({
          error: `Transcription service error (${whisperResponse.status})`,
          transcript: "[Transcription unavailable - please check API configuration]"
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

    const afrikaansText = await whisperResponse.text();

    const translationResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
              content:
                "You are a professional translator for insurance claims. Translate the following Afrikaans text into clear, professional English suitable for an insurance broker. Maintain all key details about the incident, damages, injuries, and circumstances. Use formal, insurance-industry appropriate language. If the text is already in English, return it as is. Only return the translation, no explanation.",
            },
            {
              role: "user",
              content: afrikaansText,
            },
          ],
        }),
      }
    );

    if (!translationResponse.ok) {
      throw new Error(
        `Translation API error: ${translationResponse.statusText}`
      );
    }

    const translationData = await translationResponse.json();
    const englishText =
      translationData.choices[0]?.message?.content || afrikaansText;

    return new Response(
      JSON.stringify({
        transcript: englishText,
        original: afrikaansText,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        transcript: "[Transcription failed]"
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
