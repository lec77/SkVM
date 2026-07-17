import { describe, test, expect } from "bun:test"
import { JIT_BOOST_COMPILE_FLAGS, JIT_BOOST_RUN_FLAGS, runJitBoost } from "../../src/cli/jit-boost.ts"
import { UsageError } from "../../src/cli/flags.ts"

function parseCompileError(argv: string[]): UsageError {
  try {
    JIT_BOOST_COMPILE_FLAGS.parse(argv)
  } catch (err) {
    expect(err).toBeInstanceOf(UsageError)
    return err as UsageError
  }
  throw new Error(`expected parse(${JSON.stringify(argv)}) to throw UsageError`)
}

function parseRunError(argv: string[]): UsageError {
  try {
    JIT_BOOST_RUN_FLAGS.parse(argv)
  } catch (err) {
    expect(err).toBeInstanceOf(UsageError)
    return err as UsageError
  }
  throw new Error(`expected parse(${JSON.stringify(argv)}) to throw UsageError`)
}

describe("JIT_BOOST_COMPILE_FLAGS.parse", () => {
  test("sample argv → typed config", () => {
    expect(JIT_BOOST_COMPILE_FLAGS.parse([
      "--skill=./skillvm-data/skills/weather",
      "--model=openrouter/anthropic/claude-sonnet-4.6",
    ])).toEqual({
      help: false,
      skill: "./skillvm-data/skills/weather",
      model: "openrouter/anthropic/claude-sonnet-4.6",
      "timeout-ms": undefined,
    })
  })

  test("--skill is required", () => {
    expect(parseCompileError([]).message).toBe("jit-boost compile: --skill is required")
  })

  test("--help short-circuits required flags", () => {
    expect(JIT_BOOST_COMPILE_FLAGS.parse(["--help"])).toEqual({ help: true })
  })
})

describe("JIT_BOOST_RUN_FLAGS.parse", () => {
  test("sample argv → typed config with defaults", () => {
    expect(JIT_BOOST_RUN_FLAGS.parse([
      "--cases=./cases.json",
      "--model=openrouter/example/model",
    ])).toEqual({
      help: false,
      cases: "./cases.json",
      model: "openrouter/example/model",
      adapter: "bare-agent",
      invocations: undefined,
      "promotion-threshold": 3,
      "demotion-threshold": 3,
      "match-granularity": "run",
      "extract-model": undefined,
      out: undefined,
      "json-out": undefined,
      "timeout-ms": undefined,
      "max-steps": undefined,
      "keep-workdirs": false,
      "online-refine": false,
      "refine-model": undefined,
      "refine-after-misses": 3,
      "max-refines": 1,
      "retro-promote": false,
    })
  })

  test("--cases and --model are required", () => {
    expect(parseRunError(["--model=m/x"]).message).toBe("jit-boost run: --cases is required")
    expect(parseRunError(["--cases=x.json"]).message).toBe("jit-boost run: --model is required")
  })

  test("--adapter only accepts hook-capable adapters", () => {
    expect(parseRunError(["--cases=x.json", "--model=m/x", "--adapter=opencode"]).message)
      .toBe('jit-boost run: invalid --adapter "opencode". Valid: bare-agent')
  })

  test("--match-granularity is a two-value enum", () => {
    expect(JIT_BOOST_RUN_FLAGS.parse([
      "--cases=x.json", "--model=m/x", "--match-granularity=tool-call",
    ])).toMatchObject({ "match-granularity": "tool-call" })
    expect(parseRunError(["--cases=x.json", "--model=m/x", "--match-granularity=per-token"]).message)
      .toBe('jit-boost run: invalid --match-granularity "per-token". Valid: run, tool-call')
  })

  test("unknown flag rejected with typo hint", () => {
    expect(parseRunError(["--cases=x.json", "--model=m/x", "--invocation=8"]).message).toBe(
      "jit-boost run: Unknown flag --invocation. Did you mean --invocations?\n" +
        "Run 'skvm jit-boost run --help' for the list of supported flags.",
    )
  })
})

describe("runJitBoost routing", () => {
  test("unknown sub-action throws UsageError naming the action", async () => {
    let err: unknown
    try {
      await runJitBoost(["frobnicate"])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toContain("frobnicate")
  })

  test("run with missing cases file throws UsageError before any side effect", async () => {
    let err: unknown
    try {
      await runJitBoost(["run", "--cases=/nonexistent/cases.json", "--model=openrouter/fake/model"])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toContain("/nonexistent/cases.json")
  })

  test("--online-refine with tool-call granularity throws UsageError before any side effect", async () => {
    let err: unknown
    try {
      await runJitBoost([
        "run",
        "--cases=/nonexistent/cases.json",
        "--model=openrouter/fake/model",
        "--online-refine",
        "--match-granularity=tool-call",
      ])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(UsageError)
    expect((err as UsageError).message).toContain("--online-refine requires --match-granularity=run")
  })
})
