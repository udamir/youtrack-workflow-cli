import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { readWorkflowFiles, workflowFolderHash, writeWorkflowFiles } from "../../src/tools/fs.tools"

describe("fs.tools", () => {
  describe("readWorkflowFiles", () => {
    // Set up temporary test directory
    let tempDir: string

    beforeAll(async () => {
      // Create a temporary directory
      tempDir = path.join(os.tmpdir(), `test-read-dir-${Date.now()}`)
      fs.mkdirSync(tempDir, { recursive: true })

      // Create some test files in the directory
      fs.writeFileSync(path.join(tempDir, "file1.txt"), "content 1")
      fs.writeFileSync(path.join(tempDir, "file2.json"), '{"key":"value"}')

      // Create a subdirectory that should be ignored
      const subDir = path.join(tempDir, "subdir")
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(path.join(subDir, "ignored.txt"), "this should be ignored")
    })

    afterAll(() => {
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it("should read only root-level files with correct names and file buffers", async () => {
      // Read files from the directory
      const files = await readWorkflowFiles(tempDir)

      // Should only read the two root files, not the file in the subdirectory
      expect(files.length).toBe(2)

      // Verify file names
      const fileNames = files.map((file) => file.name).sort()
      expect(fileNames).toEqual(["file1.txt", "file2.json"])

      // Verify file content
      const file1 = files.find((f) => f.name === "file1.txt")
      expect(file1).toBeDefined()
      expect(file1?.file.toString()).toBe("content 1")

      const file2 = files.find((f) => f.name === "file2.json")
      expect(file2).toBeDefined()
      expect(file2?.file.toString()).toBe('{"key":"value"}')
    })

    it("should skip directories", async () => {
      // Read files from the directory
      const files = await readWorkflowFiles(tempDir)

      // Check that no subdirectories are included
      const dirEntries = files.filter((file) => file.name === "subdir")
      expect(dirEntries.length).toBe(0)

      // Check that files in subdirectories are not included
      const ignoredFiles = files.filter((file) => file.name === "ignored.txt")
      expect(ignoredFiles.length).toBe(0)
    })

    it("should throw error for non-existent folder", async () => {
      const nonExistentPath = path.join(os.tmpdir(), `non-existent-${Date.now()}`)

      // Should throw an error for non-existent path
      await expect(readWorkflowFiles(nonExistentPath)).rejects.toThrow()
    })
  })

  describe("writeWorkflowFiles", () => {
    let tempDir: string

    beforeEach(() => {
      // Create a fresh temp directory for each test
      tempDir = path.join(os.tmpdir(), `test-write-dir-${Date.now()}`)
      fs.mkdirSync(tempDir, { recursive: true })
    })

    afterEach(() => {
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it("should write files to the target directory", async () => {
      // Create test workflow files
      const files = [
        { name: "file1.txt", file: Buffer.from("content 1") },
        { name: "file2.json", file: Buffer.from('{"key":"value"}') },
      ]

      // Write files to the temp directory
      await writeWorkflowFiles(files, tempDir)

      // Verify the files were written correctly
      const file1Path = path.join(tempDir, "file1.txt")
      const file2Path = path.join(tempDir, "file2.json")

      expect(fs.existsSync(file1Path)).toBe(true)
      expect(fs.existsSync(file2Path)).toBe(true)

      // Verify file content
      expect(fs.readFileSync(file1Path, "utf8")).toBe("content 1")
      expect(fs.readFileSync(file2Path, "utf8")).toBe('{"key":"value"}')
    })

    it("should overwrite existing files", async () => {
      // Create a file that will be overwritten
      const existingFilePath = path.join(tempDir, "existing.txt")
      fs.writeFileSync(existingFilePath, "old content")

      // Create test workflow files including the existing one with new content
      const files = [
        { name: "existing.txt", file: Buffer.from("new content") },
        { name: "new.txt", file: Buffer.from("brand new") },
      ]

      // Write files to the temp directory
      await writeWorkflowFiles(files, tempDir)

      // Verify the existing file was overwritten
      expect(fs.readFileSync(existingFilePath, "utf8")).toBe("new content")

      // Verify the new file was created
      const newFilePath = path.join(tempDir, "new.txt")
      expect(fs.existsSync(newFilePath)).toBe(true)
      expect(fs.readFileSync(newFilePath, "utf8")).toBe("brand new")
    })
  })

  describe("workflowFolderHash", () => {
    let tempDir1: string
    let tempDir2: string

    beforeAll(async () => {
      // Create first test directory with a flat structure
      tempDir1 = path.join(os.tmpdir(), `test-dir1-${Date.now()}`)
      fs.mkdirSync(tempDir1, { recursive: true })
      fs.writeFileSync(path.join(tempDir1, "file1.txt"), "content 1")
      fs.writeFileSync(path.join(tempDir1, "file2.txt"), "content 2")
      fs.writeFileSync(path.join(tempDir1, "file3.txt"), "content 3")

      // Create second test directory with the same files (flat structure)
      tempDir2 = path.join(os.tmpdir(), `test-dir2-${Date.now()}`)
      fs.mkdirSync(tempDir2, { recursive: true })
      fs.writeFileSync(path.join(tempDir2, "file1.txt"), "content 1")
      fs.writeFileSync(path.join(tempDir2, "file2.txt"), "content 2")
      fs.writeFileSync(path.join(tempDir2, "file3.txt"), "content 3")
    })

    afterAll(() => {
      // Clean up temp directories
      if (fs.existsSync(tempDir1)) {
        fs.rmSync(tempDir1, { recursive: true, force: true })
      }
      if (fs.existsSync(tempDir2)) {
        fs.rmSync(tempDir2, { recursive: true, force: true })
      }
    })

    it("should generate consistent hashes for different folder structures with same content", async () => {
      // Calculate hashes for both directories
      const hash1 = await workflowFolderHash(tempDir1)
      const hash2 = await workflowFolderHash(tempDir2)

      // Verify that the hashes are the same since both folders have identical files
      expect(hash1).toEqual(hash2)
    })

    it("should generate different hashes for different file content", async () => {
      // Create temp directories with different content
      const diffDir1 = path.join(os.tmpdir(), `test-diff1-${Date.now()}`)
      const diffDir2 = path.join(os.tmpdir(), `test-diff2-${Date.now()}`)

      try {
        // Create both directories
        fs.mkdirSync(diffDir1, { recursive: true })
        fs.mkdirSync(diffDir2, { recursive: true })

        // Create files with same names but different content
        fs.writeFileSync(path.join(diffDir1, "file1.txt"), "Content version 1")
        fs.writeFileSync(path.join(diffDir1, "file2.txt"), "Same content")

        fs.writeFileSync(path.join(diffDir2, "file1.txt"), "Content version 2") // Different content
        fs.writeFileSync(path.join(diffDir2, "file2.txt"), "Same content") // Same content

        // Calculate folder hashes
        const hash1 = await workflowFolderHash(diffDir1)
        const hash2 = await workflowFolderHash(diffDir2)

        // Verify that the hashes are different due to different content
        expect(hash1).not.toEqual(hash2)
      } finally {
        // Clean up
        if (fs.existsSync(diffDir1)) {
          fs.rmSync(diffDir1, { recursive: true, force: true })
        }
        if (fs.existsSync(diffDir2)) {
          fs.rmSync(diffDir2, { recursive: true, force: true })
        }
      }
    })

    it("should ignore file metadata differences", async () => {
      // Create temp directories for metadata test
      const metaDir1 = path.join(os.tmpdir(), `test-meta1-${Date.now()}`)
      const metaDir2 = path.join(os.tmpdir(), `test-meta2-${Date.now()}`)

      try {
        // Create both directories
        fs.mkdirSync(metaDir1, { recursive: true })
        fs.mkdirSync(metaDir2, { recursive: true })

        // Create two identical files in different folders
        const testFile1 = path.join(metaDir1, "test.txt")
        const testFile2 = path.join(metaDir2, "test.txt")

        fs.writeFileSync(testFile1, "Test content")
        fs.writeFileSync(testFile2, "Test content")

        // Modify file timestamps
        const pastDate = new Date(2020, 1, 1)
        const futureDate = new Date(2025, 6, 5)

        fs.utimesSync(testFile1, pastDate, pastDate)
        fs.utimesSync(testFile2, futureDate, futureDate)

        // Calculate folder hashes
        const hash1 = await workflowFolderHash(metaDir1)
        const hash2 = await workflowFolderHash(metaDir2)

        // Verify that the hashes are the same despite different metadata
        expect(hash1).toEqual(hash2)
      } finally {
        // Clean up
        if (fs.existsSync(metaDir1)) {
          fs.rmSync(metaDir1, { recursive: true, force: true })
        }
        if (fs.existsSync(metaDir2)) {
          fs.rmSync(metaDir2, { recursive: true, force: true })
        }
      }
    })
  })
})
