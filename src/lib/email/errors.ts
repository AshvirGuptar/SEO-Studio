/**
 * Plain-English explanations for SMTP failures (pure, so it's unit-tested). Never includes the
 * password or the raw server reply, which can echo account details.
 */
export function describeEmailError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number } | null;
  const code = err?.code ?? "";
  if (code === "EAUTH" || err?.responseCode === 535 || err?.responseCode === 534) {
    return "The mail server rejected the login. Check that SMTP_USER is the full Gmail address and SMTP_PASSWORD is a current 16-character App password (a new one is needed after every Google password change).";
  }
  if (code === "ENOAUTH") return "No mail login was given: set both SMTP_USER and SMTP_PASSWORD.";
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET" || code === "EDNS") {
    return "Couldn't connect to the mail server in time. Check SMTP_HOST / SMTP_PORT (Gmail: smtp.gmail.com, 465) or try again.";
  }
  if (code === "ETLS") return "The secure connection to the mail server failed. Use port 465 for Gmail.";
  if (code === "EENVELOPE") return "The mail server refused the sender or recipient address. EMAIL_FROM must use the SMTP_USER address.";
  if (code === "EMESSAGE") return "The mail server refused the message.";
  return code ? `Sending failed (${code}).` : "Sending failed.";
}
