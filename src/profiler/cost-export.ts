/**
 * Export profiling cost data as a CSV: one row per (model, harness,
 * primitive), aggregated across the levels that ran. `levels_run` reflects
 * exactly the levels present in the TCP details (the profiler always runs
 * L1–L3). Model and harness come from the TCP itself — full ids, so rows
 * from different adapters or same-named models across providers never
 * collide.
 */

import type { TCP } from "../core/types.ts"

export const COST_CSV_HEADER =
  "model,harness,primitive,level,levels_run,templates_run,templates_skipped,duration_ms,duration_s,cost_usd,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens"

/** Round to at most 6 decimals without trailing-zero noise. */
function usd(n: number): string {
  return String(Math.round(n * 1e6) / 1e6)
}

export function profileCostCsv(tcps: TCP[]): string {
  const rows: string[] = [COST_CSV_HEADER]

  for (const tcp of tcps) {
    for (const d of tcp.details) {
      let durationMs = 0
      let costUsd = 0
      let input = 0
      let output = 0
      let cacheRead = 0
      let cacheWrite = 0
      let run = 0
      let skipped = 0
      const levelsRun: string[] = []

      for (const lr of d.levelResults) {
        levelsRun.push(lr.level)
        durationMs += lr.durationMs
        costUsd += lr.costUsd
        input += lr.tokens.input
        output += lr.tokens.output
        cacheRead += lr.tokens.cacheRead
        cacheWrite += lr.tokens.cacheWrite
        run += lr.totalCount - lr.skipCount
        skipped += lr.skipCount
      }

      rows.push([
        tcp.model,
        tcp.harness,
        d.primitiveId,
        d.highestLevel,
        `"${levelsRun.join(",")}"`,
        String(run),
        String(skipped),
        String(Math.round(durationMs)),
        (durationMs / 1000).toFixed(1),
        usd(costUsd),
        String(input),
        String(output),
        String(cacheRead),
        String(cacheWrite),
      ].join(","))
    }
  }

  return rows.join("\n") + "\n"
}
