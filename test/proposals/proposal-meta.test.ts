import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { ProposalMetaSchema, createProposal } from "../../src/proposals/storage.ts"

describe("ProposalMetaSchema with optimizerDriver", () => {
  const base = {
    skillName: "s", skillDir: "/tmp/s",
    harness: "opencode" as const,
    optimizerModel: "anthropic/claude-sonnet-4.6",
    targetModel: "anthropic/claude-sonnet-4.6",
    source: "synthetic",
    timestamp: "t",
    status: "pending" as const,
    acceptedRound: null,
    bestRound: 0,
    bestRoundReason: "",
    roundCount: 0,
  }

  test("accepts optimizerDriver = pi", () => {
    const meta = ProposalMetaSchema.parse({ ...base, optimizerDriver: "pi" })
    expect(meta.optimizerDriver).toBe("pi")
  })

  test("accepts optimizerDriver = opencode", () => {
    const meta = ProposalMetaSchema.parse({ ...base, optimizerDriver: "opencode" })
    expect(meta.optimizerDriver).toBe("opencode")
  })

  test("tolerates missing optimizerDriver (legacy)", () => {
    const meta = ProposalMetaSchema.parse(base)
    expect(meta.optimizerDriver).toBeUndefined()
  })
})

describe("createProposal records optimizerDriver in meta.json", () => {
  let proposalsRoot: string
  let skillDir1: string
  let skillDir2: string
  beforeEach(() => {
    proposalsRoot = mkdtempSync(path.join(tmpdir(), "skvm-proposals-"))
    skillDir1 = mkdtempSync(path.join(tmpdir(), "skvm-skill-demo-"))
    skillDir2 = mkdtempSync(path.join(tmpdir(), "skvm-skill-demo2-"))
    process.env.SKVM_PROPOSALS_DIR = proposalsRoot
  })
  afterEach(() => {
    rmSync(proposalsRoot, { recursive: true, force: true })
    rmSync(skillDir1, { recursive: true, force: true })
    rmSync(skillDir2, { recursive: true, force: true })
    delete process.env.SKVM_PROPOSALS_DIR
  })

  test("writes optimizerDriver = pi when supplied", async () => {
    const { dir } = await createProposal({
      skillName: "demo",
      skillDir: skillDir1,
      harness: "opencode",
      optimizerModel: "anthropic/claude-sonnet-4.6",
      targetModel: "anthropic/claude-sonnet-4.6",
      source: "synthetic",
      optimizerDriver: "pi",
    })
    const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf-8"))
    expect(meta.optimizerDriver).toBe("pi")
  })

  test("omits optimizerDriver when not supplied", async () => {
    const { dir } = await createProposal({
      skillName: "demo2",
      skillDir: skillDir2,
      harness: "opencode",
      optimizerModel: "anthropic/claude-sonnet-4.6",
      targetModel: "anthropic/claude-sonnet-4.6",
      source: "synthetic",
    })
    const meta = JSON.parse(readFileSync(path.join(dir, "meta.json"), "utf-8"))
    expect(meta.optimizerDriver).toBeUndefined()
  })
})
