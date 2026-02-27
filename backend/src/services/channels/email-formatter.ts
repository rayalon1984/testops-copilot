/**
 * Email Formatter for Shared Analysis
 *
 * Generates HTML email content for sharing AI copilot analysis
 * via email. Uses inline styles for maximum email client compatibility.
 */

/**
 * Format a shared analysis as an HTML email.
 */
export function formatShareEmail(
    title: string,
    content: string,
    shareUrl: string,
    senderName?: string,
): string {
    const sender = senderName || 'A teammate';
    // Convert basic markdown to HTML (lightweight — just bold, italic, code, links, headers)
    const htmlContent = markdownToEmailHtml(content);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; border:1px solid #e0e0e0;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px 16px; border-bottom:1px solid #f0f0f0;">
              <p style="margin:0 0 4px; font-size:13px; color:#666;">
                ${escapeHtml(sender)} shared an AI analysis with you
              </p>
              <h1 style="margin:0; font-size:20px; color:#1a1a1a; font-weight:600;">
                ${escapeHtml(title)}
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:20px 32px; font-size:14px; line-height:1.6; color:#333;">
              ${htmlContent}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:16px 32px 24px;" align="center">
              <a href="${escapeHtml(shareUrl)}"
                 style="display:inline-block; padding:10px 24px; background:#2563eb; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">
                View Full Analysis
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; border-top:1px solid #f0f0f0; font-size:12px; color:#999;">
              Sent by TestOps Copilot. This link expires in 7 days.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Lightweight markdown → HTML for email (inline-safe).
 * Handles: bold, italic, inline code, code blocks, headers, links, lists.
 */
function markdownToEmailHtml(md: string): string {
    let html = escapeHtml(md);

    // Code blocks (``` ... ```)
    html = html.replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/, '').replace(/\n?```$/, '');
        return `<pre style="background:#f5f5f5; padding:12px; border-radius:4px; font-size:13px; overflow-x:auto; font-family:monospace;">${code}</pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0; padding:1px 4px; border-radius:3px; font-size:13px;">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers (## and ###)
    html = html.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px; font-size:15px; color:#1a1a1a;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="margin:16px 0 8px; font-size:17px; color:#1a1a1a;">$1</h2>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li style="margin:2px 0;">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="padding-left:20px; margin:8px 0;">${match}</ul>`);

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p style="margin:8px 0;">');
    html = `<p style="margin:8px 0;">${html}</p>`;

    return html;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
