import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  email: string;
  invitationUrl: string;
  brokerageName: string;
  role: string;
  expiresAt: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, invitationUrl, brokerageName, role, expiresAt }: RequestPayload = await req.json();

    console.log('📧 Sending invitation email to:', email);
    console.log('🏢 Brokerage:', brokerageName);
    console.log('🔗 Invitation URL:', invitationUrl);

    // Validate input
    if (!email || !invitationUrl || !brokerageName) {
      throw new Error('Missing required fields: email, invitationUrl, or brokerageName');
    }

    // Format expiration date
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send email via Resend
    const resendApiKey = 're_8xNifB24_GdoZh8yj9mLppPURCsUmhsqk';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to Join ${brokerageName}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo h1 {
              color: #1d4ed8;
              margin: 0;
              font-size: 28px;
            }
            h2 {
              color: #1d4ed8;
              margin-top: 0;
            }
            .button {
              display: inline-block;
              background-color: #1d4ed8;
              color: white !important;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .button:hover {
              background-color: #1e40af;
            }
            .info-box {
              background-color: #f0f9ff;
              border-left: 4px solid #1d4ed8;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #6b7280;
              text-align: center;
            }
            .url-box {
              background-color: #f9fafb;
              padding: 12px;
              border-radius: 4px;
              word-break: break-all;
              font-family: monospace;
              font-size: 12px;
              color: #4b5563;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>ClaimsPortal</h1>
            </div>

            <h2>You've Been Invited!</h2>

            <p>Hello,</p>

            <p>You have been invited to join <strong>${brokerageName}</strong> as a <strong>${role}</strong> on the ClaimsPortal platform.</p>

            <div class="info-box">
              <strong>🎯 What's Next?</strong>
              <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                <li>Click the button below to accept your invitation</li>
                <li>Create your account with a secure password</li>
                <li>Start managing insurance claims efficiently</li>
              </ul>
            </div>

            <center>
              <a href="${invitationUrl}" class="button">Accept Invitation & Sign Up</a>
            </center>

            <p style="font-size: 14px; color: #6b7280;">
              Or copy and paste this link into your browser:
            </p>
            <div class="url-box">
              ${invitationUrl}
            </div>

            <div class="info-box">
              <strong>⏰ Important:</strong> This invitation expires on <strong>${expiryDate}</strong>
            </div>

            <div class="footer">
              <p>This is an automated message from ClaimsPortal.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
You've Been Invited to Join ${brokerageName}

You have been invited to join ${brokerageName} as a ${role} on the ClaimsPortal platform.

To accept your invitation and create your account, please visit:
${invitationUrl}

This invitation expires on ${expiryDate}.

If you didn't expect this invitation, you can safely ignore this email.

---
ClaimsPortal - Insurance Claims Management
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ClaimsPortal <invitations@claimsportal.co.za>',
        to: [email],
        subject: `Invitation to Join ${brokerageName} on ClaimsPortal`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error('❌ Resend API error:', errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const resendData = await resendResponse.json();
    console.log('✅ Email sent successfully:', resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent successfully',
        emailId: resendData.id,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error sending invitation email:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
