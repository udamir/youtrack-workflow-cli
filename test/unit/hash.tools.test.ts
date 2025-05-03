import { calculateHash, filesHash } from "../../src/tools/hash.tools"

describe("hash.tools", () => {
  describe("calculateHash", () => {
    it("should calculate consistent hash for the same input", () => {
      const content = Buffer.from("test content")
      const hash1 = calculateHash(content)
      const hash2 = calculateHash(content)

      expect(hash1).toEqual(hash2)
    })

    it("should calculate different hashes for different inputs", () => {
      const content1 = Buffer.from("test content 1")
      const content2 = Buffer.from("test content 2")

      const hash1 = calculateHash(content1)
      const hash2 = calculateHash(content2)

      expect(hash1).not.toEqual(hash2)
    })
  })

  describe("filesHash", () => {
    it("should generate consistent hashes for the same files regardless of order", () => {
      // Create two sets of the same files but in different order
      const files1 = [
        { name: "file1.txt", file: Buffer.from("abc123") },
        { name: "file2.txt", file: Buffer.from("def456") },
        { name: "file3.txt", file: Buffer.from("ghi789") },
      ]

      const files2 = [
        { name: "file3.txt", file: Buffer.from("ghi789") },
        { name: "file1.txt", file: Buffer.from("abc123") },
        { name: "file2.txt", file: Buffer.from("def456") },
      ]

      // Calculate hashes for both
      const hash1 = filesHash(files1)
      const hash2 = filesHash(files2)

      // They should be the same since the content is the same
      expect(hash1).toEqual(hash2)
    })

    it("should generate different hashes for different file content", () => {
      const files1 = [
        { name: "file1.txt", file: Buffer.from("content 1") },
        { name: "file2.txt", file: Buffer.from("content 2") },
      ]

      const files2 = [
        { name: "file1.txt", file: Buffer.from("different content 1") },
        { name: "file2.txt", file: Buffer.from("content 2") },
      ]

      const hash1 = filesHash(files1)
      const hash2 = filesHash(files2)

      expect(hash1).not.toEqual(hash2)
    })

    it("should generate different hashes for different sets of files", () => {
      const files1 = [
        { name: "file1.txt", file: Buffer.from("content") },
        { name: "file2.txt", file: Buffer.from("content") },
      ]

      const files2 = [
        { name: "file1.txt", file: Buffer.from("content") },
        { name: "file3.txt", file: Buffer.from("content") }, // Different filename
      ]

      const hash1 = filesHash(files1)
      const hash2 = filesHash(files2)

      expect(hash1).not.toEqual(hash2)
    })

    it("should handle empty file arrays", () => {
      const emptyHash = filesHash([])

      // Should return a valid hash string
      expect(typeof emptyHash).toBe("string")
      expect(emptyHash.length).toBeGreaterThan(0)
    })
  })
})
