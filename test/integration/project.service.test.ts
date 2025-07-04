import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"

import { ProjectService, YoutrackService } from "../../src/services"
import { readLockFile } from "../../src/tools/fs.tools"
import type { WorkflowHash } from "../../src/types"
import { TestHelper } from "./test-helpers"

describe("ProjectService Integration", () => {
  let helper: TestHelper
  let projectService: ProjectService
  let youtrackService: YoutrackService
  let testWorkflowName: string

  // Generate a unique test workflow name
  const timestamp = Date.now()
  const randomSuffix = crypto.randomBytes(4).toString("hex")

  beforeAll(async () => {
    helper = new TestHelper()
    await helper.setup()

    const youtrackHost = process.env.YOUTRACK_BASE_URL || ""
    const youtrackToken = process.env.YOUTRACK_TOKEN || ""

    youtrackService = new YoutrackService(youtrackHost, youtrackToken)
    projectService = new ProjectService(youtrackService)

    // Create a unique workflow name for testing
    testWorkflowName = `test-workflow-${timestamp}-${randomSuffix}`

    // Create a test workflow directory
    await helper.createWorkflowDir(testWorkflowName)
  })

  afterAll(async () => {
    await helper.cleanup()
  })

  describe("Workflow Management", () => {
    it("should update lock file with workflow information", async () => {
      // Arrange
      const testHash = "test-hash-value"

      // Act - directly set the workflow hash in the workflows object
      // Access internal state through the updateLockFile method
      const mockWorkflows: Record<string, WorkflowHash> = {}
      mockWorkflows[testWorkflowName] = {
        hash: testHash,
        fileHashes: {},
      }
      projectService.updateLockFile(mockWorkflows)

      // Assert
      const lockData = readLockFile()

      expect(lockData.workflows).toBeDefined()
      expect(lockData.workflows[testWorkflowName]).toBeDefined()
      expect(lockData.workflows[testWorkflowName].hash).toBe(testHash)
    })

    it("should cache local workflow files correctly", async () => {
      // Act
      const cacheResult = await projectService.cacheLocalWorkflow(testWorkflowName)

      // Assert
      expect(cacheResult).toBeDefined()
      expect(cacheResult?.files).toBeDefined()
      expect(Array.isArray(cacheResult?.files)).toBe(true)
      expect(cacheResult?.files.length).toBeGreaterThan(0)
      expect(cacheResult?.hash).toBeDefined()
      expect(typeof cacheResult?.hash).toBe("string")
    })

    it("should list available workflows from YouTrack", async () => {
      // Act
      const projectWorkflows = await projectService.notAddedWorkflows()

      // Assert
      expect(Array.isArray(projectWorkflows)).toBe(true)
      console.log(`Available workflows: ${projectWorkflows.join(", ")}`)
    })
  })

  describe("Workflow Status Management", () => {
    // Tests in this section will work with real local files

    it("should detect local modifications to workflow files", async () => {
      // This test focuses on local file modifications only,
      // without requiring server access

      // 1. Cache the workflow and get its hash
      const initialCache = await projectService.cacheLocalWorkflow(testWorkflowName)
      expect(initialCache).toBeDefined()
      const initialHash = initialCache!.hash

      // 2. Set the original hash in lock file
      // Access internal state through the updateLockFile method
      const mockWorkflows: Record<string, WorkflowHash> = {}
      mockWorkflows[testWorkflowName] = {
        hash: initialHash,
        fileHashes: {},
      }
      projectService.updateLockFile(mockWorkflows)

      // 3. Verify that the current status shows files match original
      const lockData = readLockFile()
      expect(lockData.workflows[testWorkflowName]).toBeDefined()
      expect(lockData.workflows[testWorkflowName].hash).toBe(initialHash)

      // 4. Modify the workflow.js file
      const workflowJsPath = path.join(process.cwd(), testWorkflowName, "workflow.js")
      const originalContent = await fs.promises.readFile(workflowJsPath, "utf-8")
      const modifiedContent = `${originalContent}\n// Modified at ${Date.now()}`
      await fs.promises.writeFile(workflowJsPath, modifiedContent)

      try {
        // 5. Force clear cache to ensure fresh calculation
        // @ts-ignore - accessing private property for testing
        projectService._localCache = new Map()

        // Wait a moment to ensure filesystem changes are detected
        await new Promise((resolve) => setTimeout(resolve, 100))

        // 6. Get the new hash
        const modifiedCache = await projectService.cacheLocalWorkflow(testWorkflowName)
        expect(modifiedCache).toBeDefined()

        // 7. Verify hash has changed
        expect(modifiedCache?.hash).not.toEqual(initialHash)

        // 8. Verify that the local hash differs from lock file hash
        const localFiles = modifiedCache?.hash
        const originalFiles = lockData.workflows[testWorkflowName].hash

        // 9. Manual verification of MODIFIED state (comparing hashes)
        expect(localFiles).not.toEqual(originalFiles)
        console.log("Detected hash change - local files were modified")
      } finally {
        // 10. Restore the original file content
        await fs.promises.writeFile(workflowJsPath, originalContent)
      }
    })

    it("should update lock file with current workflow hash", async () => {
      // 1. First, ensure the workflow exists and is cached
      const cacheResult = await projectService.cacheLocalWorkflow(testWorkflowName)
      expect(cacheResult).toBeDefined()
      const currentHash = cacheResult!.hash

      // 2. Set this hash in lock file
      // Access internal state through the updateLockFile method
      const mockWorkflows: Record<string, WorkflowHash> = {}
      mockWorkflows[testWorkflowName] = {
        hash: currentHash,
        fileHashes: {},
      }
      projectService.updateLockFile(mockWorkflows)

      // 3. Read the lock file to verify
      const lockData = readLockFile()

      // 4. Verify the hash was properly set
      expect(lockData.workflows[testWorkflowName]).toBeDefined()
      expect(lockData.workflows[testWorkflowName].hash).toBe(currentHash)
    })

    it("should identify changes in workflow files", async () => {
      // 1. Get initial file list
      const initialCache = await projectService.cacheLocalWorkflow(testWorkflowName)
      expect(initialCache).toBeDefined()
      expect(initialCache?.files.length).toBeGreaterThan(0)

      // 2. Create a new file in the workflow directory
      const newFilePath = path.join(process.cwd(), testWorkflowName, "newfile.txt")
      await fs.promises.writeFile(newFilePath, "This is a new file")

      try {
        // 3. Cache again and check that the hash and file count changed
        // @ts-ignore - accessing private property for testing
        projectService._localCache = new Map()

        const updatedCache = await projectService.cacheLocalWorkflow(testWorkflowName)
        expect(updatedCache).toBeDefined()
        expect(updatedCache?.hash).not.toEqual(initialCache?.hash)
        // biome-ignore lint/style/noNonNullAssertion: false positive
        expect(updatedCache?.files?.length).toBeGreaterThan(initialCache!.files.length)
      } finally {
        // 4. Clean up by removing the new file
        await fs.promises.unlink(newFilePath)
      }
    })
  })
})
