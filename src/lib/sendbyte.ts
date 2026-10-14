export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  eventType: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  const apiKey = process.env.SENDBYTE_API_KEY;
  const fromEmail = process.env.SENDBYTE_FROM_EMAIL || 'notifications@sendbyte.africa';
  const fromName = process.env.SENDBYTE_FROM_NAME || 'TemuTasks';

  if (!apiKey) {
    console.warn('[Sendbyte] API Key missing. Skipping email dispatch.');
    return { success: false, error: 'SENDBYTE_API_KEY not configured' };
  }

  try {
    const res = await fetch('https://api.sendbyte.africa/v1/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data?.id || data?.messageId || 'sent',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Connection error to Sendbyte',
    };
  }
}

// Branded email layout builder
export function renderEmailTemplate({
  title,
  preheader,
  contentHtml,
  ctaText,
  ctaUrl,
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F7F8; margin: 0; padding: 20px; color: #111827; }
    .container { max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; overflow: hidden; }
    .header { background: #111827; padding: 24px; text-align: center; }
    .brand { color: #FFFFFF; font-size: 22px; font-weight: 700; text-decoration: none; }
    .brand span { color: #F95700; }
    .body { padding: 32px 28px; }
    .title { font-size: 20px; font-weight: 700; color: #111827; margin-top: 0; margin-bottom: 16px; }
    .content { font-size: 15px; line-height: 1.6; color: #4B5563; }
    .btn { display: inline-block; background-color: #F95700; color: #FFFFFF !important; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 24px; }
    .footer { padding: 20px 28px; background: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Temu<span>Tasks</span></div>
    </div>
    <div class="body">
      <h1 class="title">${title}</h1>
      <div class="content">${contentHtml}</div>
      ${ctaText && ctaUrl ? `<div style="text-align: center;"><a href="${ctaUrl}" class="btn">${ctaText}</a></div>` : ''}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TemuTasks Nigeria. All rights reserved.<br>
      Independent participant reward & task platform.
    </div>
  </div>
</body>
</html>
  `;
}
