import { test, expect, describe } from "bun:test"
import { profileCostCsv } from "../../src/profiler/cost-export.ts"
import type { TCP } from "../../src/core/types.ts"

function makeTcp(model: string, primitives: Array<{
  id: string
  highest: "L0" | "L1" | "L2" | "L3"
  levels: Array<{ level: "L1" | "L2" | "L3"; durationMs: number; costUsd: number; input: number; output: number; cacheRead: number; cacheWrite?: number; total: number; skip: number }>
}>): TCP {
  return {
    version: "1.0",
    model,
    harness: "bare-agent",
    profiledAt: "2026-01-01T00:00:00Z",
    capabilities: Object.fromEntries(primitives.map((p) => [p.id, p.highest])),
    details: primitives.map((p) => ({
      primitiveId: p.id,
      highestLevel: p.highest,
      levelResults: p.levels.map((l) => ({
        level: l.level,
        passed: true,
        passCount: l.total - l.skip,
        totalCount: l.total,
        skipCount: l.skip,
        durationMs: l.durationMs,
        costUsd: l.costUsd,
        tokens: { input: l.input, output: l.output, cacheRead: l.cacheRead, cacheWrite: l.cacheWrite ?? 0 },
        testDescription: "",
        failureDetails: [],
      })),
    })),
    cost: { totalUsd: 0, totalTokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, durationMs: 0 },
    isPartial: false,
  }
}

describe("profileCostCsv", () => {
  test("one row per (model, harness, primitive), summed across levels", () => {
    const tcp = makeTcp("provider/model-a", [
      {
        id: "gen.regex", highest: "L2",
        levels: [
          { level: "L1", durationMs: 1000, costUsd: 0.001, input: 100, output: 10, cacheRead: 5, cacheWrite: 2, total: 3, skip: 0 },
          { level: "L2", durationMs: 2500, costUsd: 0.004, input: 300, output: 40, cacheRead: 0, cacheWrite: 7, total: 3, skip: 1 },
        ],
      },
    ])
    const csv = profileCostCsv([tcp])
    const [header, row] = csv.trim().split("\n")
    expect(header).toBe("model,harness,primitive,level,levels_run,templates_run,templates_skipped,duration_ms,duration_s,cost_usd,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens")
    expect(row).toBe('provider/model-a,bare-agent,gen.regex,L2,"L1,L2",5,1,3500,3.5,0.005,400,50,5,9')
  })

  test("rows carry the full model id and harness from the TCP itself", () => {
    const a = makeTcp("provider/model-a", [{ id: "p.one", highest: "L1", levels: [{ level: "L1", durationMs: 100, costUsd: 0.01, input: 1, output: 2, cacheRead: 3, total: 1, skip: 0 }] }])
    const b = makeTcp("other-provider/model-a", [{ id: "p.two", highest: "L3", levels: [{ level: "L3", durationMs: 200, costUsd: 0.02, input: 4, output: 5, cacheRead: 6, total: 2, skip: 0 }] }])
    const csv = profileCostCsv([a, b])
    const lines = csv.trim().split("\n")
    expect(lines).toHaveLength(3)
    // Same short model name, different providers — rows stay distinguishable.
    expect(lines[1]).toContain("provider/model-a,bare-agent,p.one,L1")
    expect(lines[2]).toContain("other-provider/model-a,bare-agent,p.two,L3")
  })
})
