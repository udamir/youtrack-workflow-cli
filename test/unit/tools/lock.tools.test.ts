import * as fs from "node:fs"
import * as path from "node:path"

import { 
  readLockFile,
  writeLockFile,
  getLockFilePath
} from "../../../src/tools/lock.tools"
import type { LockFileData, WorkflowHash } from "../../../src/types"

// Mock fs module
jest.mock("node:fs")

// Create test data
const mockLockData: LockFileData = {
  workflows: {
    "test-workflow": {
      hash: "test-hash",
      files: { "file1.js": "file1-hash", "file2.js": "file2-hash" }
    }
  }
}

describe("Lock Tools", () => {
  // Mock process.cwd() for testing
  const originalCwd = process.cwd
  const TEST_DIR = "/test/dir"

  beforeEach(() => {
    // Mock process.cwd()
    jest.spyOn(process, "cwd").mockReturnValue(TEST_DIR)
    
    // Reset fs mocks
    jest.resetAllMocks()
  })

  afterEach(() => {
    // Restore process.cwd()
    jest.spyOn(process, "cwd").mockRestore()
  })

  describe("getLockFilePath", () => {
    it("should return path to lock file in project directory", () => {
      const lockPath = getLockFilePath()
      expect(lockPath).toBe(path.join(TEST_DIR, "ytw.lock"))
    })
  })

  describe("readLockFile", () => {
    it("should read lock file when it exists", () => {
      // Mock fs.readFileSync to return test data
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockLockData))

      const result = readLockFile()
      
      // Verify file was read
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join(TEST_DIR, "ytw.lock"),
        "utf-8"
      )
      
      // Verify data matches expectations
      expect(result).toEqual(mockLockData)
    })

    it("should return empty lock data when file doesn't exist", () => {
      // Mock fs.readFileSync to throw error
      jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("File not found")
      })

      const result = readLockFile()
      
      // Verify empty data is returned
      expect(result).toEqual({ workflows: {} })
    })
  })

  describe("writeLockFile", () => {
    it("should write lock data to file", () => {
      // Mock fs.writeFileSync
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})

      writeLockFile(mockLockData)
      
      // Verify file was written
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(TEST_DIR, "ytw.lock"),
        JSON.stringify(mockLockData, null, 2),
        "utf-8"
      )
    })

    it("should throw error when write fails", () => {
      // Mock fs.writeFileSync to throw error
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
        throw new Error("Write failed")
      })

      // Expect error to be thrown
      expect(() => writeLockFile(mockLockData)).toThrow("Failed to write lock file")
    })
  })
})
