export function sanitizeUserInput(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .slice(0, 5000)
    .replace(/\$\{/g, "${'$'}{")
    .replace(/```/g, "'''")
    .replace(/ignore\s+previous\s+instructions?/gi, "[filtered]")
    .replace(/disregard\s+(all|previous|above)/gi, "[filtered]")
    .replace(/system\s*[:>]/gi, "[filtered]")
    .replace(/assistant\s*[:>]/gi, "[filtered]")
    .trim();
}

export function wrapUserContent(text: string, label: string): string {
  return `<${label}>\n${sanitizeUserInput(text)}\n</${label}>`;
}
