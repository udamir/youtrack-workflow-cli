import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { describe, it, beforeEach, afterEach, beforeAll, afterAll, expect, mock, spyOn } from "bun:test"

import { readLocalWorkflowFiles, localWorkflowFolderHash, writeLocalWorkflowFiles } from "../../src/tools/fs.tools"
import { readLockFile, writeLockFile, getLockFilePath } from "../../src/tools/fs.tools"
import type { LockFileData } from "../../src/types"

describe("fs.tools", () => {
  beforeEach(() => {
    // Mock process.cwd() to return the temp directory
    spyOn(process, "cwd").mockImplementation(() => os.tmpdir())
  })

  afterEach(() => {
    // Restore original cwd
    spyOn(process, "cwd").mockRestore()
  })

  describe("readLocalWorkflowFiles", () => {
    // Set up temporary test directory
    let tempDir: string
    let workflowName: string

    beforeAll(async () => {
      // Create a temporary directory with a timestamp to ensure uniqueness
      const timestamp = Date.now()
      workflowName = `test-read-dir-${timestamp}`
      tempDir = path.join(os.tmpdir(), workflowName)
      fs.mkdirSync(tempDir, { recursive: true })

      // Create some test files in the directory
      fs.writeFileSync(path.join(tempDir, "file1.txt"), "content 1")
      fs.writeFileSync(path.join(tempDir, "file2.json"), '{"key":"value"}')

      // Create a subdirectory that should be ignored
      const subDir = path.join(tempDir, "subdir")
      fs.mkdirSync(subDir, { recursive: true })
      fs.writeFileSync(path.join(subDir, "ignored.txt"), "ignored content")

      // Create a file in the .git directory that should be ignored
      const gitDir = path.join(tempDir, ".git")
      fs.mkdirSync(gitDir, { recursive: true })
      fs.writeFileSync(path.join(gitDir, "ignored.txt"), "ignored content")
    })

    afterAll(() => {
      // Clean up
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it("should read only root-level files with correct names and file buffers", async () => {
      // Read files from the directory
      const files = await readLocalWorkflowFiles(workflowName)

      // Should only read the two root files, not the file in the subdirectory
      expect(files.length).toBe(2)

      // Check that file names are extracted correctly
      const fileNames = files.map((f) => f.name).sort()
      expect(fileNames).toEqual(["file1.txt", "file2.json"].sort())

      // Check content is read correctly
      const file1 = files.find((f) => f.name === "file1.txt")
      expect(file1?.file.toString()).toBe("content 1")

      const file2 = files.find((f) => f.name === "file2.json")
      expect(file2?.file.toString()).toBe('{"key":"value"}')
    })

    it("should skip directories", async () => {
      // Read files from the directory
      const files = await readLocalWorkflowFiles(workflowName)

      // Check that no subdirectories are included
      const dirEntries = files.filter((file) => file.name === "subdir")
      expect(dirEntries.length).toBe(0)

      // Check that files in subdirectories are not included
      const ignoredFiles = files.filter((file) => file.name === "ignored.txt")
      expect(ignoredFiles.length).toBe(0)
    })

    it("should throw error for non-existent directory", async () => {
      const nonExistentName = `non-existent-${Date.now()}`

      // Should throw an error for non-existent path
      await expect(readLocalWorkflowFiles(nonExistentName)).rejects.toThrow()
    })
  })

  describe("writeLocalWorkflowFiles", () => {
    let workflowName: string
    let tempDir: string

    beforeEach(() => {
      // Create a temporary directory with timestamp to ensure uniqueness
      const timestamp = Date.now()
      workflowName = `test-write-dir-${timestamp}`
      tempDir = path.join(os.tmpdir(), workflowName)
      fs.mkdirSync(tempDir, { recursive: true })

      // Create a file that will be overwritten in one of the tests
      const existingFilePath = path.join(tempDir, "existing.txt")
      fs.writeFileSync(existingFilePath, "old content")
    })

    afterEach(() => {
      // Clean up
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it("should write files to the target directory", async () => {
      // Create test files
      const files = [
        { name: "file1.txt", file: Buffer.from("test content 1") },
        { name: "file2.json", file: Buffer.from('{"key":"value"}') },
      ]

      // Write files to the temp directory
      await writeLocalWorkflowFiles(files, workflowName)

      // Verify the files were written correctly
      const file1Path = path.join(tempDir, "file1.txt")
      const file2Path = path.join(tempDir, "file2.json")

      expect(fs.existsSync(file1Path)).toBe(true)
      expect(fs.existsSync(file2Path)).toBe(true)

      // Verify file content
      expect(fs.readFileSync(file1Path, "utf8")).toBe("test content 1")
      expect(fs.readFileSync(file2Path, "utf8")).toBe('{"key":"value"}')
    })

    it("should overwrite existing files", async () => {
      // Create a file that already exists to test overwriting
      const existingFilePath = path.join(tempDir, "existing.txt")

      // Create test files
      const files = [
        { name: "existing.txt", file: Buffer.from("new content") },
        { name: "new.txt", file: Buffer.from("This is a new file") },
      ]

      // Write files to the temp directory
      await writeLocalWorkflowFiles(files, workflowName)

      // Verify the existing file was overwritten
      expect(fs.readFileSync(existingFilePath, "utf8")).toBe("new content")

      // Verify the new file was created
      const newFilePath = path.join(tempDir, "new.txt")
      expect(fs.existsSync(newFilePath)).toBe(true)
      expect(fs.readFileSync(newFilePath, "utf8")).toBe("This is a new file")
    })
  })

  describe("localWorkflowFolderHash", () => {
    let dir1Name: string
    let dir2Name: string
    let tempDir1: string
    let tempDir2: string

    beforeAll(async () => {
      // Create unique names for test directories
      const timestamp = Date.now()
      dir1Name = `test-dir1-${timestamp}`
      dir2Name = `test-dir2-${timestamp}`

      tempDir1 = path.join(os.tmpdir(), dir1Name)
      tempDir2 = path.join(os.tmpdir(), dir2Name)

      // Create first test directory with files
      fs.mkdirSync(tempDir1, { recursive: true })
      fs.writeFileSync(path.join(tempDir1, "file1.txt"), "Content 1")
      fs.writeFileSync(path.join(tempDir1, "file2.txt"), "Content 2")

      // Create second test directory with same files but different order
      fs.mkdirSync(tempDir2, { recursive: true })
      // Write files in reverse order to test that ordering doesn't affect hash
      fs.writeFileSync(path.join(tempDir2, "file2.txt"), "Content 2")
      fs.writeFileSync(path.join(tempDir2, "file1.txt"), "Content 1")
    })

    afterAll(() => {
      // Clean up
      if (fs.existsSync(tempDir1)) {
        fs.rmSync(tempDir1, { recursive: true, force: true })
      }
      if (fs.existsSync(tempDir2)) {
        fs.rmSync(tempDir2, { recursive: true, force: true })
      }
    })

    it("should generate consistent hashes for different folder structures with same content", async () => {
      // Calculate hashes for both directories
      const hash1 = await localWorkflowFolderHash(dir1Name)
      const hash2 = await localWorkflowFolderHash(dir2Name)

      // Verify that the hashes are the same since both folders have identical files
      expect(hash1).toEqual(hash2)
    })

    it("should generate different hashes for different file content", async () => {
      // Create unique names for test directories
      const timestamp = Date.now()
      const diffDir1Name = `test-diff1-${timestamp}`
      const diffDir2Name = `test-diff2-${timestamp}`

      const diffDir1 = path.join(os.tmpdir(), diffDir1Name)
      const diffDir2 = path.join(os.tmpdir(), diffDir2Name)

      try {
        // Create two directories with different content
        fs.mkdirSync(diffDir1, { recursive: true })
        fs.mkdirSync(diffDir2, { recursive: true })

        // Add files with different content
        fs.writeFileSync(path.join(diffDir1, "file1.txt"), "Different content") // Different content
        fs.writeFileSync(path.join(diffDir1, "file2.txt"), "Same content") // Same content

        fs.writeFileSync(path.join(diffDir2, "file1.txt"), "Another different content") // Different content
        fs.writeFileSync(path.join(diffDir2, "file2.txt"), "Same content") // Same content

        // Calculate folder hashes
        const hash1 = await localWorkflowFolderHash(diffDir1Name)
        const hash2 = await localWorkflowFolderHash(diffDir2Name)

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
      // Create unique names for test directories
      const timestamp = Date.now()
      const metaDir1Name = `test-meta1-${timestamp}`
      const metaDir2Name = `test-meta2-${timestamp}`

      const metaDir1 = path.join(os.tmpdir(), metaDir1Name)
      const metaDir2 = path.join(os.tmpdir(), metaDir2Name)

      try {
        fs.mkdirSync(metaDir1, { recursive: true })
        fs.mkdirSync(metaDir2, { recursive: true })

        // Add identical files to both directories
        fs.writeFileSync(path.join(metaDir1, "file1.txt"), "Test content")
        fs.writeFileSync(path.join(metaDir1, "file2.txt"), "More content")

        fs.writeFileSync(path.join(metaDir2, "file1.txt"), "Test content")
        fs.writeFileSync(path.join(metaDir2, "file2.txt"), "More content")

        // Set different file permissions on the second directory
        const testFile1 = path.join(metaDir2, "file1.txt")
        const testFile2 = path.join(metaDir2, "file2.txt")

        // Set different access and modification times
        const pastDate = new Date(2020, 1, 1)
        const futureDate = new Date(2030, 1, 1)
        fs.utimesSync(testFile1, pastDate, pastDate)
        fs.utimesSync(testFile2, futureDate, futureDate)

        // Calculate folder hashes
        const hash1 = await localWorkflowFolderHash(metaDir1Name)
        const hash2 = await localWorkflowFolderHash(metaDir2Name)

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

  describe("Lock File Functions", () => {
    const LOCK_FILE_NAME = "ytw.lock"

    // Create test data
    const mockLockData: LockFileData = {
      workflows: {
        "test-workflow": {
          hash: "test-hash",
          fileHashes: { "file1.js": "file1-hash", "file2.js": "file2-hash" },
        },
      },
    }

    let tempDir: string

    beforeEach(() => {
      // Create a temporary directory for each test
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lock-file-test-"))
    })

    afterEach(() => {
      // Clean up any created files
      if (fs.existsSync(path.join(tempDir, LOCK_FILE_NAME))) {
        fs.unlinkSync(path.join(tempDir, LOCK_FILE_NAME))
      }
      fs.rmdirSync(tempDir)
    })

    describe("getLockFilePath", () => {
      it("should return path to lock file in project directory", () => {
        // Save original process.cwd
        const originalCwd = process.cwd

        try {
          // Mock process.cwd to return the temp directory
          process.cwd = mock().mockReturnValue(tempDir)

          // Test the function
          const lockPath = getLockFilePath()
          expect(lockPath).toBe(path.join(tempDir, LOCK_FILE_NAME))
        } finally {
          // Restore original process.cwd
          process.cwd = originalCwd
        }
      })
    })

    describe("readLockFile", () => {
      it("should read lock file when it exists", () => {
        // Save original process.cwd
        const originalCwd = process.cwd

        try {
          // Create a lock file with test data
          const lockFilePath = path.join(tempDir, LOCK_FILE_NAME)
          fs.writeFileSync(lockFilePath, JSON.stringify(mockLockData), "utf-8")

          // Mock process.cwd to return the temp directory
          process.cwd = mock().mockReturnValue(tempDir)

          // Test the function
          const result = readLockFile()

          // Verify the result
          expect(result).toEqual(mockLockData)
        } finally {
          // Restore original process.cwd
          process.cwd = originalCwd
        }
      })

      it("should return empty lock data when file doesn't exist", () => {
        // Save original process.cwd
        const originalCwd = process.cwd

        try {
          // Mock process.cwd to return the temp directory
          process.cwd = mock().mockReturnValue(tempDir)

          // The lock file doesn't exist yet

          // Test the function
          const result = readLockFile()

          // Verify the result
          expect(result).toEqual({ workflows: {} })
        } finally {
          // Restore original process.cwd
          process.cwd = originalCwd
        }
      })
    })

    describe("writeLockFile", () => {
      it("should write lock data to file", () => {
        // Save original process.cwd
        const originalCwd = process.cwd

        try {
          // Mock process.cwd to return the temp directory
          process.cwd = mock().mockReturnValue(tempDir)

          // Test the function
          writeLockFile(mockLockData)

          // Verify the file was written
          const lockFilePath = path.join(tempDir, LOCK_FILE_NAME)
          expect(fs.existsSync(lockFilePath)).toBe(true)

          // Verify the contents
          const fileContent = fs.readFileSync(lockFilePath, "utf-8")
          expect(JSON.parse(fileContent)).toEqual(mockLockData)
        } finally {
          // Restore original process.cwd
          process.cwd = originalCwd
        }
      })

      it("should throw error when write fails", () => {
        // Save original process.cwd
        const originalCwd = process.cwd

        try {
          // Mock process.cwd to return a non-existent directory
          const nonExistentDir = path.join(os.tmpdir(), `non-existent-dir-${Math.random().toString(36).substring(7)}`)
          process.cwd = mock().mockReturnValue(nonExistentDir)

          // Test the function - should throw since the directory doesn't exist
          expect(() => writeLockFile(mockLockData)).toThrow()
        } finally {
          // Restore original process.cwd
          process.cwd = originalCwd
        }
      })
    })
  })
})
