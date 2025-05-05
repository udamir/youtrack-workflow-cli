import { calculateHash, calculateWorkflowHash } from "../../src/tools/hash.tools"
import type { WorkflowFile } from "../../src/types"

describe("Hash Tools", () => {
  it("should calculate correct hash", () => {
    const buffer = Buffer.from("test")
    const hash = calculateHash(buffer)
    expect(hash).toBe("098f6bcd4621d373cade4e832627b4f6")
  })

  it("should calculate correct workflow hash", () => {
    const files: WorkflowFile[] = [
      { name: "file1.js", file: Buffer.from("content1") },
      { name: "file2.js", file: Buffer.from("content2") },
    ]

    const { hash, fileHashes } = calculateWorkflowHash(files)
    
    // Verify individual file hashes
    expect(fileHashes["file1.js"]).toBe("9297ab3fbd56b42f6566284119238125")
    expect(fileHashes["file2.js"]).toBe("6685cd62c0c26d8eda769b28436c437e")
    
    // Verify overall hash (will change if implementation changes)
    expect(hash).toBeDefined()
    expect(typeof hash).toBe("string")
  })
})
