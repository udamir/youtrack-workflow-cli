import { 
  calculateHash,
  calculateWorkflowHash
} from "../../../src/tools/hash.tools"
import type { WorkflowFile } from "../../../src/types"

describe("Hash Tools Unit Tests", () => {
  describe("calculateHash", () => {
    it("should calculate correct MD5 hash", () => {
      const content = Buffer.from("test content")
      const hash = calculateHash(content)
      
      // Expected MD5 hash for "test content"
      expect(hash).toBe("9473fdd0d880a43c21b7778d34872157")
    })
  })

  describe("calculateWorkflowHash", () => {
    it("should calculate file hashes and overall hash", () => {
      const files: WorkflowFile[] = [
        { name: "file1.js", file: Buffer.from("content1") },
        { name: "file2.js", file: Buffer.from("content2") }
      ]
      
      const result = calculateWorkflowHash(files)
      
      // Check structure of result
      expect(result).toHaveProperty("hash")
      expect(result).toHaveProperty("files")
      
      // Check file hashes
      expect(result.files["file1.js"]).toBe("9297ab3fbd56b42f6566284119238125")
      expect(result.files["file2.js"]).toBe("6685cd62c0c26d8eda769b28436c437e")
    })
    
    it("should be deterministic regardless of file order", () => {
      // Create two sets with the same files but different order
      const files1: WorkflowFile[] = [
        { name: "file1.js", file: Buffer.from("content1") },
        { name: "file2.js", file: Buffer.from("content2") }
      ]
      
      const files2: WorkflowFile[] = [
        { name: "file2.js", file: Buffer.from("content2") },
        { name: "file1.js", file: Buffer.from("content1") }
      ]
      
      const hash1 = calculateWorkflowHash(files1).hash
      const hash2 = calculateWorkflowHash(files2).hash
      
      // Hashes should be the same
      expect(hash1).toBe(hash2)
    })
  })
})
