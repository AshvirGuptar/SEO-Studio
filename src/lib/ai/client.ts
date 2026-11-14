/** The one place the Anthropic client is created. Server-only: the key never reaches the browser. */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment. Retries 429/5xx twice by default.
  client ??= new Anthropic({ timeout: 110_000 });
  return client;
}
