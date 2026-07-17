import { test, expect, describe } from "bun:test"
import { filterServableCandidates } from "../../src/jit-boost/candidates.ts"
import type { BoostCandidate } from "../../src/jit-boost/types.ts"

const GOOD: BoostCandidate = {
  purposeId: "fetch-current-weather",
  keywords: ["weather", "forecast"],
  codeSignature: "wttr\\.in",
  functionTemplate: "curl -s 'https://wttr.in/${city}?format=3'",
  params: {
    city: { type: "string", description: "City name", extractPattern: "(?:in|for)\\s+([A-Za-z ]+)" },
  },
  materializationType: "shell",
}

describe("filterServableCandidates", () => {
  test("accepts a well-formed candidate", () => {
    expect(filterServableCandidates([GOOD])).toEqual([GOOD])
  })

  test("zero-param candidates are servable", () => {
    const noParams: BoostCandidate = { ...GOOD, purposeId: "static-report", params: {} }
    expect(filterServableCandidates([noParams])).toEqual([noParams])
  })

  test("rejects a candidate whose codeSignature does not compile", () => {
    const broken: BoostCandidate = { ...GOOD, codeSignature: "([" }
    expect(filterServableCandidates([broken])).toEqual([])
  })

  test("rejects duplicate purposeIds, keeping the first", () => {
    const dup: BoostCandidate = { ...GOOD, codeSignature: "other\\.api" }
    const accepted = filterServableCandidates([GOOD, dup])
    expect(accepted).toHaveLength(1)
    expect(accepted[0]!.codeSignature).toBe(GOOD.codeSignature)
  })

  test("rejects params without an extractPattern (object and string forms)", () => {
    const noPattern: BoostCandidate = {
      ...GOOD,
      params: { city: { type: "string", description: "City name" } },
    }
    const stringForm: BoostCandidate = {
      ...GOOD,
      purposeId: "other-purpose",
      params: { city: "City name" },
    }
    expect(filterServableCandidates([noPattern, stringForm])).toEqual([])
  })

  test("rejects params whose extractPattern does not compile", () => {
    const badPattern: BoostCandidate = {
      ...GOOD,
      params: { city: { type: "string", description: "City name", extractPattern: "([" } },
    }
    expect(filterServableCandidates([badPattern])).toEqual([])
  })

  test("empty functionTemplate is rejected only under requireTemplate", () => {
    const phase1: BoostCandidate = { ...GOOD, functionTemplate: "" }
    expect(filterServableCandidates([phase1])).toEqual([phase1])
    expect(filterServableCandidates([phase1], { requireTemplate: true })).toEqual([])
  })
})
