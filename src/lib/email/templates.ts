/** Email bodies (pure, so they're easy to test). Every value is escaped before going into HTML. */
import { BRAND } from "../brand";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface EmailContent { subject: string; text: string; html: string }

export function resetPasswordEmail({ name, url, minutes }: { name: string; url: string; minutes: number }): EmailContent {
  const hi = name.trim() ? `Hi ${name.trim()},` : "Hi,";
  const subject = `Reset your ${BRAND.name} password`;
  const text = [
    hi,
    "",
    `Someone asked to reset the password for your ${BRAND.name} account. To choose a new password, open this link:`,
    url,
    "",
    `The link works once and expires in ${minutes} minutes. If you didn't ask for this, ignore this email; your password stays the same.`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:18px;font-weight:bold;padding-bottom:16px">${esc(BRAND.name)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5">${esc(hi)}<br><br>Someone asked to reset the password for your account. Choose a new password with the button below.</td></tr>
<tr><td style="padding:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#F15A29;color:#0b0b0c;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:8px">Choose a new password</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#52525b">The link works once and expires in ${minutes} minutes. If you didn&#39;t ask for this, ignore this email; your password stays the same.<br><br>Button not working? Paste this into your browser:<br><span style="word-break:break-all">${esc(url)}</span></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
