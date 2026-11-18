/**
 * Extracts inbound tokens from recipient addresses: any address whose domain
 * is the configured inbound domain contributes its local part (lowercased).
 * Handles display-name form (`Name <token@domain>`).
 */
export function extractInboundTokens(
  recipients: string[],
  inboundDomain: string,
): string[] {
  const domain = inboundDomain.trim().toLowerCase();
  const tokens: string[] = [];
  for (const recipient of recipients) {
    const angle = recipient.match(/<([^>]+)>/);
    const address = (angle ? angle[1] : recipient).trim().toLowerCase();
    const at = address.lastIndexOf("@");
    if (at <= 0) continue;
    if (address.slice(at + 1) !== domain) continue;
    const token = address.slice(0, at);
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}
