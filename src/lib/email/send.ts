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
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      // Never let message content read local files or fetch URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return transport;
}

export function isEmailEnabled(): boolean {
  return emailEnvConfigured();
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  if (!isEmailEnabled()) throw new Error("Email isn't configured (SMTP_USER / SMTP_PASSWORD).");
  const from = process.env.EMAIL_FROM || `"${BRAND.name}" <${process.env.SMTP_USER}>`;
  await getTransport().sendMail({ from, to, subject: content.subject, text: content.text, html: content.html });
}
