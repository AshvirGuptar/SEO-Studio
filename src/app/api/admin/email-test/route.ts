import { requireAdmin } from "@/lib/auth/guard";
import { isEmailEnabled, sendEmail } from "@/lib/email/send";
import { describeEmailError } from "@/lib/email/errors";
import { BRAND } from "@/lib/brand";

/** Sends a test email to the signed-in admin and reports exactly why it failed, if it did. */
export async function POST() {
  const r = await requireAdmin();
  if (r.error) return r.error;
  if (!isEmailEnabled()) {
    return Response.json({ error: "Email isn't set up: add SMTP_USER and SMTP_PASSWORD in Vercel, then redeploy." }, { status: 503 });
  }
  try {
    await sendEmail(r.user.email, {
      subject: `${BRAND.name} test email`,
      text: `This is a test from ${BRAND.name}. If you can read it, password-reset emails will be delivered.`,
      html: `<p>This is a test from ${BRAND.name}. If you can read it, password-reset emails will be delivered.</p>`,
    });
    return Response.json({ ok: true, to: r.user.email });
  } catch (e) {
    const message = describeEmailError(e);
    console.error(`[email] test email failed: ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
