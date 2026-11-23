/**
 * Outgoing email over SMTP (server-only). Configured with SMTP_USER + SMTP_PASSWORD, e.g. a Gmail
 * address and an App password (Google Account → Security → App passwords). Optional: SMTP_HOST
 * (default smtp.gmail.com), SMTP_PORT (default 465, TLS), EMAIL_FROM (default "<brand> <SMTP_USER>").
 */
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { BRAND } from "../brand";
import { emailEnvConfigured } from "../auth/enabled";
import type { EmailContent } from "./templates";

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      // Gmail shows App passwords as "abcd efgh ijkl mnop"; spaces pasted into Vercel would break login.
      auth: { user: smtpUser(), pass: (process.env.SMTP_PASSWORD ?? "").replace(/\s+/g, "") },
      // Fail fast: the defaults (up to 2 minutes to connect) outlast a serverless request.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      // Never let message content read local files or fetch URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return transport;
}

function smtpUser(): string {
  return (process.env.SMTP_USER ?? "").trim();
}

/** The address emails come from (shown to admins on Team & access). */
export function emailSenderAddress(): string | null {
  return isEmailEnabled() ? smtpUser() : null;
}

export function isEmailEnabled(): boolean {
  return emailEnvConfigured();
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  if (!isEmailEnabled()) throw new Error("Email isn't configured (SMTP_USER / SMTP_PASSWORD).");
  const from = process.env.EMAIL_FROM?.trim() || `"${BRAND.name}" <${smtpUser()}>`;
  await getTransport().sendMail({ from, to, subject: content.subject, text: content.text, html: content.html });
}
