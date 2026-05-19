/**
 * Auto-probe verdict logic and Anthropic-shape baseUrl inference.
 *
 * Pure functions consumed by `runProbe` (probe.ts) and `AutoProbeProvider`
 * (auto-probe.ts). Splitting these out keeps the LLM-touching probe call
 * independently testable from the wrapper's retry orchestration.
 *
 * Spec: docs/skvm/2026-05-19-provider-auto-probe.md (Section "Verdict mapping").
 */

export type ProbeVerdict = "clean" | "polluted" | "indeterminate"

/** Markers that prove the argument string is not pure JSON. */
const POLLUTION_PATTERNS = [
  /<think\b/i,
  /<\/think>/i,
  /\bACHI\b/,
  /<tool_call\b/i,
  /<arg_key>/i,
  /<arg_value>/i,
]

/**
 * Classify a raw `tool_calls[0].function.arguments` string against the
 * expected probe response object. Returns:
 *   - "clean": parses as JSON and exactly equals `expected`
 *   - "polluted": fails to parse, OR contains a known pollution marker,
 *     OR parses but fields don't match
 *   - "indeterminate" is not produced here — that's reserved for
 *     network/transport failures in `runProbe`.
 */
export function classifyArguments(
  raw: string,
  expected: Record<string, unknown>,
): Exclude<ProbeVerdict, "indeterminate"> {
  for (const re of POLLUTION_PATTERNS) {
    if (re.test(raw)) return "polluted"
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return "polluted"
  }
  if (!parsed || typeof parsed !== "object") return "polluted"
  for (const [k, v] of Object.entries(expected)) {
    if ((parsed as Record<string, unknown>)[k] !== v) return "polluted"
  }
  return "clean"
}

/**
 * Given an OpenAI-compatible baseUrl, return the most likely
 * Anthropic-shaped baseUrl on the same host. The Anthropic SDK appends
 * `/v1/messages` itself, so we strip a trailing `/v1` (with or without
 * trailing slash) and pass the bare host+path back.
 *
 * Returns null when the input is unusable (empty, malformed URL).
 */
export function inferAnthropicBaseUrl(openaiBaseUrl: string): string | null {
  if (!openaiBaseUrl) return null
  let url: URL
  try {
    url = new URL(openaiBaseUrl)
  } catch {
    return null
  }
  const stripped = url.pathname.replace(/\/v1\/?$/, "")
  url.pathname = stripped
  // URL.toString() may append a trailing "/" — strip to match SDK conventions.
  return url.toString().replace(/\/$/, "")
}
