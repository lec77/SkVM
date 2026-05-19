import { test, expect, describe } from "bun:test"
import { classifyArguments, inferAnthropicBaseUrl } from "../../src/providers/probe.ts"

describe("classifyArguments", () => {
  const expected = { name: "probe", score: 42 }

  test("clean: exact JSON match", () => {
    expect(classifyArguments('{"name":"probe","score":42}', expected)).toBe("clean")
  })
  test("clean: whitespace and escaping variations", () => {
    expect(classifyArguments('{"name": "probe", "score": 42}', expected)).toBe("clean")
  })
  test("polluted: <think> prefix", () => {
    expect(classifyArguments('<think>x</think>{"name":"probe","score":42}', expected)).toBe("polluted")
  })
  test("polluted: lone </think> token", () => {
    expect(classifyArguments("用户思考...</think>{}", expected)).toBe("polluted")
  })
  test("polluted: ACHI marker", () => {
    expect(classifyArguments("ACHI mid ACHI{}", expected)).toBe("polluted")
  })
  test("polluted: GLM private tool_call XML", () => {
    expect(classifyArguments("<tool_call>extract<arg_key>name</arg_key><arg_value>probe</arg_value></tool_call>", expected)).toBe("polluted")
  })
  test("polluted: parse succeeds but values mismatch", () => {
    expect(classifyArguments('{"name":"other","score":42}', expected)).toBe("polluted")
  })
  test("polluted: parse succeeds but missing key", () => {
    expect(classifyArguments('{"name":"probe"}', expected)).toBe("polluted")
  })
})

describe("inferAnthropicBaseUrl", () => {
  test("strips trailing /v1", () => {
    expect(inferAnthropicBaseUrl("https://svip.xty.app/v1")).toBe("https://svip.xty.app")
  })
  test("strips trailing /v1/", () => {
    expect(inferAnthropicBaseUrl("https://svip.xty.app/v1/")).toBe("https://svip.xty.app")
  })
  test("returns unchanged when no /v1 suffix", () => {
    expect(inferAnthropicBaseUrl("https://api.example.com")).toBe("https://api.example.com")
  })
  test("returns null on invalid input", () => {
    expect(inferAnthropicBaseUrl("")).toBe(null)
    expect(inferAnthropicBaseUrl("not-a-url")).toBe(null)
  })
})
