import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { parseSince } from "../../src/utils"

describe("Utils", () => {
  describe("parseSince", () => {
    const mockNow = 1700000000000 // Fixed timestamp for testing
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      Date.now = mock(() => mockNow)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("should parse raw timestamp", () => {
      expect(parseSince("1699999000000")).toBe(1699999000000)
      expect(parseSince("0")).toBe(0)
    })

    it("should parse seconds duration", () => {
      expect(parseSince("30s")).toBe(mockNow - 30 * 1000)
      expect(parseSince("1s")).toBe(mockNow - 1000)
    })

    it("should parse minutes duration", () => {
      expect(parseSince("5m")).toBe(mockNow - 5 * 60_000)
      expect(parseSince("1m")).toBe(mockNow - 60_000)
    })

    it("should parse hours duration", () => {
      expect(parseSince("1h")).toBe(mockNow - 3_600_000)
      expect(parseSince("2h")).toBe(mockNow - 2 * 3_600_000)
    })

    it("should parse days duration", () => {
      expect(parseSince("1d")).toBe(mockNow - 86_400_000)
      expect(parseSince("7d")).toBe(mockNow - 7 * 86_400_000)
    })

    it("should parse weeks duration", () => {
      expect(parseSince("1w")).toBe(mockNow - 604_800_000)
      expect(parseSince("2w")).toBe(mockNow - 2 * 604_800_000)
    })

    it("should parse compound durations", () => {
      // 1h 5m = 1 hour + 5 minutes
      expect(parseSince("1h 5m")).toBe(mockNow - (3_600_000 + 5 * 60_000))

      // 2d 3h 30m = 2 days + 3 hours + 30 minutes
      expect(parseSince("2d 3h 30m")).toBe(mockNow - (2 * 86_400_000 + 3 * 3_600_000 + 30 * 60_000))

      // 1w 2d = 1 week + 2 days
      expect(parseSince("1w 2d")).toBe(mockNow - (604_800_000 + 2 * 86_400_000))
    })

    it("should parse compound durations without spaces", () => {
      expect(parseSince("1h5m")).toBe(mockNow - (3_600_000 + 5 * 60_000))
    })

    it("should throw error for invalid format", () => {
      expect(() => parseSince("invalid")).toThrow('Invalid --since format: "invalid"')
      expect(() => parseSince("abc")).toThrow('Invalid --since format: "abc"')
      expect(() => parseSince("")).toThrow('Invalid --since format: ""')
    })

    it("should throw error for unsupported units", () => {
      expect(() => parseSince("5y")).toThrow('Invalid --since format: "5y"')
      expect(() => parseSince("10M")).toThrow('Invalid --since format: "10M"')
    })
  })
})
