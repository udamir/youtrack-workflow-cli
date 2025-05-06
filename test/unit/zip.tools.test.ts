import JSZip from "jszip"
import { calculateWorkflowZipHash, unzipWorkflowFiles, zipWorkflowFiles } from "../../src/tools/zip.tools"

describe("zip.tools", () => {
  describe("calculateWorkflowZipHash", () => {
    it("should generate different hashes for different zip structures with same content", async () => {
      // Create two test zip files with the same content but different file names
      const zip1 = new JSZip()
      const zip2 = new JSZip()

      // Add files to zip1 with one set of filenames
      zip1.file("file1.txt", "Test content 1")
      zip1.file("file2.txt", "Test content 2")

      // Add files to zip2 with different filenames but same content
      zip2.file("different_name1.txt", "Test content 1")
      zip2.file("different_name2.txt", "Test content 2")

      // Generate zip buffers
      const buffer1 = await zip1.generateAsync({ type: "nodebuffer" })
      const buffer2 = await zip2.generateAsync({ type: "nodebuffer" })

      // With current implementation, filenames are considered in the hash
      const contentHash1 = await calculateWorkflowZipHash(Buffer.from(buffer1))
      const contentHash2 = await calculateWorkflowZipHash(Buffer.from(buffer2))
      expect(contentHash1).not.toEqual(contentHash2)
    })

    it("should generate different hashes for different content", async () => {
      // Create two test zip files with different content but same structure
      const zip1 = new JSZip()
      const zip2 = new JSZip()

      // Add files to zip1
      zip1.file("file1.txt", "Content version 1")
      zip1.file("file2.txt", "Same content")

      // Add files to zip2 with same names but some different content
      zip2.file("file1.txt", "Content version 2") // Different content
      zip2.file("file2.txt", "Same content") // Same content

      // Generate zip buffers
      const buffer1 = await zip1.generateAsync({ type: "nodebuffer" })
      const buffer2 = await zip2.generateAsync({ type: "nodebuffer" })

      // Verify that calculateWorkflowZipHash correctly detects different content
      const contentHash1 = await calculateWorkflowZipHash(Buffer.from(buffer1))
      const contentHash2 = await calculateWorkflowZipHash(Buffer.from(buffer2))
      expect(contentHash1).not.toEqual(contentHash2)
    })

    it("should ignore zip metadata differences", async () => {
      // Create two different zip objects with the same content
      const zip1 = new JSZip()
      const zip2 = new JSZip()

      // Add the same file content but with different timestamps
      const fileDate1 = new Date(2020, 1, 1)
      const fileDate2 = new Date(2025, 6, 5)

      zip1.file("test.txt", "Test content", {
        date: fileDate1,
        comment: "First zip comment", // Add comment to make files different
      })

      zip2.file("test.txt", "Test content", {
        date: fileDate2,
        comment: "Second zip comment", // Different comment
      })

      // Generate two buffers with different metadata
      const buffer1 = await zip1.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE" as const,
        compressionOptions: { level: 6 },
        comment: "First archive",
      })

      const buffer2 = await zip2.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE" as const,
        compressionOptions: { level: 6 },
        comment: "Second archive",
      })

      // WorkflowHash should produce identical hashes since the content is the same
      // Metadata differences are still ignored
      const contentHash1 = await calculateWorkflowZipHash(Buffer.from(buffer1))
      const contentHash2 = await calculateWorkflowZipHash(Buffer.from(buffer2))
      expect(contentHash1).toEqual(contentHash2)
    })
  })

  describe("unzipWorkflowFiles", () => {
    it("should extract files from zip with correct names and file buffers", async () => {
      // Create a test zip with multiple files (only in root level)
      const zip = new JSZip()
      zip.file("file1.txt", "Content 1")
      zip.file("file2.json", '{"key": "value"}')
      zip.file("file3.js", 'console.log("test");')

      // Generate the zip as a buffer
      const buffer = await zip.generateAsync({ type: "nodebuffer" })

      // Extract files
      const files = await unzipWorkflowFiles(buffer)

      // Should extract exactly the files we added
      expect(files.length).toBe(3)

      // Should have extracted correct filenames
      const fileNames = files.map((file) => file.name).sort()
      expect(fileNames).toContain("file1.txt")
      expect(fileNames).toContain("file2.json")
      expect(fileNames).toContain("file3.js")

      // Check that file content was correctly extracted
      const file1 = files.find((f) => f.name === "file1.txt")
      expect(file1).toBeDefined()
      expect(file1?.file.toString()).toBe("Content 1")
    })
  })

  describe("zipWorkflowFiles", () => {
    it("should create a zip archive from workflow files", async () => {
      // Create test workflow files
      const files = [
        { name: "file1.txt", file: Buffer.from("Content 1") },
        { name: "file2.json", file: Buffer.from('{"key": "value"}') },
      ]

      // Archive the files
      const zipBuffer = await zipWorkflowFiles(files)

      // Verify it's a valid zip buffer
      expect(Buffer.isBuffer(zipBuffer)).toBe(true)
      expect(zipBuffer.length).toBeGreaterThan(0)

      // Extract the files again to verify content is preserved
      const extractedFiles = await unzipWorkflowFiles(zipBuffer)

      // Should have the same number of files
      expect(extractedFiles.length).toBe(files.length)

      // Verify file names
      const extractedFileNames = extractedFiles.map((f) => f.name).sort()
      const originalFileNames = files.map((f) => f.name).sort()
      expect(extractedFileNames).toEqual(originalFileNames)

      // Verify file content
      for (const file of files) {
        const extracted = extractedFiles.find((f) => f.name === file.name)
        expect(extracted).toBeDefined()
        expect(extracted?.file.toString()).toEqual(file.file.toString())
      }
    })
  })
})
