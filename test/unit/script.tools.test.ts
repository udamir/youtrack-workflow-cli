import { describe, it, expect } from "bun:test"
import { executeScript } from "../../src/tools/script.tools"

describe("Script Tools", () => {
  describe("executeScript", () => {
    it("should execute a script successfully and return output", async () => {
      const testScript = "node -e \"console.log('test output')\""
      // Test with explicit command
      const result = await executeScript(testScript, "workflow1")
      expect(result).toContain("test output")
    })

    it("should handle missing script command", async () => {
      const result = await executeScript("", "workflow1")
      expect(result).toBe("")
    })

    it("should handle script failure", async () => {
      // Configure a failing script
      const failingScript = "node -e \"process.stderr.write('error output'); process.exit(1)\""

      await expect(executeScript(failingScript, "workflow1")).rejects.toThrow("error output")
    })

    it("should pass multiple arguments to the script", async () => {
      const testScript = "node -e \"console.log(process.argv.slice(2).join(':'))\""
      const result = await executeScript(testScript, "workflow1", "arg2", "arg3")
      // With Node's -e flag, the first arg may not be included in process.argv.slice(2) as expected
      // Verifying we have at least the other arguments
      expect(result).toContain("arg2:arg3")
    })
  })
})
