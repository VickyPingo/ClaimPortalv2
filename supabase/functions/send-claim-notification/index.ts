import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ClaimData {
  id: string;
  claimantName: string;
  claimantPhone: string;
  claimantEmail?: string;
  incidentType: string;
  accidentDateTime?: string;
  locationAddress?: string;
  carCondition?: string;
  panelBeaterLocation?: string;
  voiceTranscript?: string;
  damagePhotoCount?: number;
  hasThirdPartyDocs?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { claimId, brokerageId }: { claimId: string; brokerageId: string } = await req.json();

    if (!claimId || !brokerageId) {
      return new Response(
        JSON.stringify({ error: "Missing claimId or brokerageId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      throw new Error("Claim not found");
    }

    const { data: brokerage, error: brokerageError } = await supabase
      .from("brokerages")
      .select("notification_email, name")
      .eq("id", brokerageId)
      .single();

    if (brokerageError || !brokerage || !brokerage.notification_email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No notification email configured for this brokerage"
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email service not configured"
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

    const incidentTypeLabel = claim.incident_type === "motor_accident"
      ? "Motor Accident"
      : "Burst Geyser";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .section { background-color: white; padding: 15px; margin: 15px 0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .label { font-weight: bold; color: #1e40af; margin-top: 10px; }
    .value { margin-bottom: 10px; }
    .transcript { background-color: #f3f4f6; padding: 15px; border-left: 4px solid #1e40af; margin: 10px 0; font-style: italic; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 New Claim Submitted</h1>
    </div>

    <div class="content">
      <div class="section">
        <h2>Claim Information</h2>
        <div class="label">Claim ID:</div>
        <div class="value">${claim.id}</div>

        <div class="label">Incident Type:</div>
        <div class="value">${incidentTypeLabel}</div>

        <div class="label">Status:</div>
        <div class="value">${claim.status}</div>

        <div class="label">Submitted:</div>
        <div class="value">${new Date(claim.created_at).toLocaleString()}</div>
      </div>

      <div class="section">
        <h2>Contact Person</h2>
        <div class="label">Name:</div>
        <div class="value">${claim.claimant_name || "Not provided"}</div>

        <div class="label">Phone:</div>
        <div class="value"><a href="tel:${claim.claimant_phone}">${claim.claimant_phone || "Not provided"}</a></div>

        ${claim.claimant_email ? `
        <div class="label">Email:</div>
        <div class="value"><a href="mailto:${claim.claimant_email}">${claim.claimant_email}</a></div>
        ` : ""}
      </div>

      ${claim.incident_type === "motor_accident" ? `
      <div class="section">
        <h2>Accident Details</h2>
        ${claim.accident_date_time ? `
        <div class="label">Date & Time:</div>
        <div class="value">${new Date(claim.accident_date_time).toLocaleString()}</div>
        ` : ""}

        ${claim.location_address ? `
        <div class="label">Location:</div>
        <div class="value">${claim.location_address}</div>
        ` : ""}

        ${claim.car_condition ? `
        <div class="label">Car Condition:</div>
        <div class="value">${claim.car_condition === "drivable" ? "Drivable" : "Not Drivable (needs towing)"}</div>
        ` : ""}

        ${claim.panel_beater_location ? `
        <div class="label">Preferred Panel Beater:</div>
        <div class="value">${claim.panel_beater_location}</div>
        ` : ""}

        ${claim.damage_photo_urls && claim.damage_photo_urls.length > 0 ? `
        <div class="label">Damage Photos:</div>
        <div class="value">${claim.damage_photo_urls.length} photo(s) uploaded</div>
        ` : ""}

        ${claim.driver_license_photo_url || claim.license_disk_photo_url ? `
        <div class="label">Driver Documentation:</div>
        <div class="value">
          ${claim.driver_license_photo_url ? "✓ Driver's License " : ""}
          ${claim.license_disk_photo_url ? "✓ License Disk" : ""}
        </div>
        ` : ""}

        ${claim.third_party_license_photo_url || claim.third_party_disk_photo_url ? `
        <div class="label">Third Party Documentation:</div>
        <div class="value">
          ${claim.third_party_license_photo_url ? "✓ Third Party License " : ""}
          ${claim.third_party_disk_photo_url ? "✓ Third Party Disk" : ""}
        </div>
        ` : ""}
      </div>
      ` : ""}

      ${claim.incident_type === "burst_geyser" && claim.location_address ? `
      <div class="section">
        <h2>Location</h2>
        <div class="value">${claim.location_address}</div>
      </div>
      ` : ""}

      ${claim.voice_transcript_en ? `
      <div class="section">
        <h2>Voice Statement (Transcribed to English)</h2>
        <div class="transcript">
          ${claim.voice_transcript_en}
        </div>
      </div>
      ` : ""}

      ${claim.voice_note_url && !claim.voice_transcript_en ? `
      <div class="section">
        <h2>Voice Statement</h2>
        <div class="value">
          <a href="${claim.voice_note_url}" target="_blank">Listen to voice note</a>
        </div>
      </div>
      ` : ""}

      <div class="section">
        <h2>Next Steps</h2>
        <p>Please log in to your dashboard to review the full claim details, including all uploaded photos and documents.</p>
      </div>
    </div>

    <div class="footer">
      <p>This is an automated notification from your Insurance Claims System</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Claims System <onboarding@resend.dev>",
        to: [brokerage.notification_email],
        subject: `New ${incidentTypeLabel} Claim - ${claim.claimant_name || "Contact: " + claim.claimant_phone}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResult.id,
        message: "Notification email sent successfully"
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Email notification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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
