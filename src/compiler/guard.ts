/**
 * Guard: validates compiled skill output.
 *
 * The guard catches BROKEN artifacts, not structural drift. Aggressive
 * compression and restructuring are the compiler's core value — a distilled
 * variant is routinely a small fraction of the original's size — so the
 * guard must never require code blocks or headings to survive verbatim.
 *
 * Checks:
 * 1. Expansion ceiling — net added lines within a tiered budget (compression
 *    is unlimited; bloat is the failure mode).
 * 2. Non-degenerate output — the compiled skill retains a minimal amount of
 *    real content relative to the original.
 * 3. Frontmatter identity — if the original had frontmatter, the compiled
 *    skill must still open with a frontmatter block, and its `name:` value
 *    must match the original's. Wording of other keys may change; identity
 *    may not.
 * 4. Reference integrity — every bundle-relative path the compiled skill
 *    mentions (scripts/…, plus any directory actually shipped in the bundle)
 *    must exist in the shipped bundle. Hallucinated file references break
 *    the skill at runtime.
 */

export interface GuardResult {
  passed: boolean
  violations: string[]
}

export interface GuardOptions {
  /**
   * Relative paths of the files shipped alongside SKILL.md. When provided,
   * bundle-style references in the compiled skill are checked against it;
   * when omitted the reference check is skipped (callers without directory
   * context, e.g. pure-text tests).
   */
  bundlePaths?: string[]
}

export function validateGuard(
  original: string,
  compiled: string,
  opts?: GuardOptions,
): GuardResult {
  const violations: string[] = []

  // 1. Expansion ceiling: tiered threshold based on original size.
  //    Short skills (<100 lines) get generous expansion — they may need more
  //    compensation relative to their size. Long skills get tight limits —
  //    expansion there is almost certainly noise. Shrinking is never capped.
  const origLines = original.split("\n").length
  const compLines = compiled.split("\n").length
  const addedLines = compLines - origLines
  const expansionFactor = origLines < 100 ? 2.0 : origLines < 200 ? 1.0 : 0.5
  const maxAdded = Math.ceil(origLines * expansionFactor)
  if (addedLines > maxAdded) {
    violations.push(
      `Length: added ${addedLines} lines (max ${maxAdded}, ${origLines} original)`
    )
  }

  // 2. Non-degenerate output: 5% of the original's non-empty lines, capped at
  //    ten. Far below any useful execution card, so this only catches
  //    empty/garbage writes — never aggressive-but-real compression.
  const nonEmpty = (text: string) => text.split("\n").filter((l) => l.trim().length > 0).length
  const compNonEmpty = nonEmpty(compiled)
  const floor = Math.min(10, Math.ceil(nonEmpty(original) * 0.05))
  if (compNonEmpty < floor) {
    violations.push(
      `Degenerate output: ${compNonEmpty} non-empty lines (floor ${floor})`
    )
  }

  // 3. Frontmatter identity
  const origFrontmatter = extractFrontmatter(original)
  if (origFrontmatter !== null) {
    const compFrontmatter = extractFrontmatter(compiled)
    const origName = extractFrontmatterName(origFrontmatter)
    if (compFrontmatter === null) {
      violations.push("Frontmatter dropped (original had one)")
    } else if (origName !== null) {
      const compName = extractFrontmatterName(compFrontmatter)
      if (compName === null) {
        violations.push("Frontmatter lost its name: key")
      } else if (compName !== origName) {
        violations.push(`Frontmatter name changed: "${origName}" → "${compName}"`)
      }
    }
  }

  // 4. Reference integrity (only when the caller supplied the bundle listing)
  if (opts?.bundlePaths !== undefined) {
    const normalized = opts.bundlePaths.map(normalizePath)
    const bundle = new Set(normalized)
    // Check the conventional bundle directories plus every top-level
    // directory the bundle actually ships — a dropped references/foo.md must
    // be caught even though "references" is not a conventional name.
    const dirs = new Set(BUNDLE_DIR_PREFIXES)
    for (const p of normalized) {
      const slash = p.indexOf("/")
      if (slash > 0) dirs.add(p.slice(0, slash))
    }
    for (const ref of extractBundleRefs(compiled, dirs)) {
      if (!bundle.has(normalizePath(ref))) {
        violations.push(`Dangling reference: "${ref}" not in skill bundle`)
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}

/** Directories whose mention in a skill implies a shipped bundle file. */
const BUNDLE_DIR_PREFIXES = ["scripts", "assets", "templates", "tools", "bin"]

/**
 * Extract bundle-relative file references like `scripts/helper.py` from the
 * compiled text. Only paths under the given directories (the conventional
 * bundle names plus directories the bundle actually ships) are considered —
 * bare filenames and absolute paths are ambiguous (outputs, fixtures, system
 * binaries) and produce false positives.
 */
function extractBundleRefs(text: string, dirs: ReadonlySet<string>): string[] {
  const refs = new Set<string>()
  const prefix = [...dirs].map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const regex = new RegExp(`(?:^|[\\s\`'"(=])((?:${prefix})/[A-Za-z0-9_\\-./]+)`, "gm")
  let match
  while ((match = regex.exec(text)) !== null) {
    // Strip trailing punctuation that markdown/prose attaches to paths.
    const cleaned = match[1]!.replace(/[.,;:)\]}>]+$/, "")
    // Directory-style mentions ("scripts/") carry no file claim to verify.
    if (cleaned.endsWith("/")) continue
    refs.add(cleaned)
  }
  return [...refs]
}

function normalizePath(p: string): string {
  return p.replace(/^\.\//, "").replace(/\\/g, "/")
}

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  return match ? match[1]! : null
}

/** The trimmed, unquoted value of a frontmatter block's `name:` key. */
function extractFrontmatterName(frontmatter: string): string | null {
  const match = frontmatter.match(/^name\s*:\s*(.*)$/m)
  if (!match) return null
  return match[1]!.trim().replace(/^(["'])(.*)\1$/, "$2")
}
