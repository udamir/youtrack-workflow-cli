import { ProjectService } from "../../src/services/project.service"
import { YoutrackService } from "../../src/services/youtrack.service"
import { TestHelper } from "./test-helpers"
import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"

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
  }, 30000) // Allow 30 seconds for setup

  afterAll(async () => {
    await helper.cleanup()
  })

  describe("Workflow Management", () => {
    it("should update package.json with workflow information", async () => {
      // Arrange
      const testHash = "test-hash-value"

      // Act
      projectService.setWorkflowHash(testWorkflowName, testHash)
      projectService.updatePackageJson()

      // Assert
      const pkgPath = path.join(process.cwd(), "package.json")
      const pkgContent = await fs.promises.readFile(pkgPath, "utf-8")
      const pkg = JSON.parse(pkgContent)

      expect(pkg.workflows).toBeDefined()
      expect(pkg.workflows[testWorkflowName]).toBe(testHash)
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
      const availableWorkflows = await projectService.availableWorkflows()

      // Assert
      expect(availableWorkflows).toBeDefined()
      expect(Array.isArray(availableWorkflows)).toBe(true)
      console.log(`Available workflows: ${availableWorkflows.join(", ")}`)
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

      // 2. Set the original hash in package.json
      projectService.setWorkflowHash(testWorkflowName, initialHash)
      projectService.updatePackageJson()

      // 3. Verify that the current status shows files match original
      const pkgPath = path.join(process.cwd(), "package.json")
      const pkgContent = await fs.promises.readFile(pkgPath, "utf-8")
      const pkg = JSON.parse(pkgContent)
      expect(pkg.workflows[testWorkflowName]).toBe(initialHash)

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

        // 8. Verify that the local hash differs from package.json hash
        const localFiles = modifiedCache?.hash
        const originalFiles = pkg.workflows[testWorkflowName]

        // 9. Manual verification of MODIFIED state (comparing hashes)
        expect(localFiles).not.toEqual(originalFiles)
        console.log("Detected hash change - local files were modified")
      } finally {
        // 10. Restore the original file content
        await fs.promises.writeFile(workflowJsPath, originalContent)
      }
    })

    it("should update package.json with current workflow hash", async () => {
      // 1. First, ensure the workflow exists and is cached
      const cacheResult = await projectService.cacheLocalWorkflow(testWorkflowName)
      expect(cacheResult).toBeDefined()
      const currentHash = cacheResult!.hash

      // 2. Set this hash in package.json
      projectService.setWorkflowHash(testWorkflowName, currentHash)
      projectService.updatePackageJson()

      // 3. Read the package.json to verify
      const pkgPath = path.join(process.cwd(), "package.json")
      const pkgContent = await fs.promises.readFile(pkgPath, "utf-8")
      const pkg = JSON.parse(pkgContent)

      // 4. Verify the hash was properly set
      expect(pkg.workflows[testWorkflowName]).toBe(currentHash)
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
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        expect(updatedCache?.files?.length).toBeGreaterThan(initialCache!.files.length)
      } finally {
        // 4. Clean up by removing the new file
        await fs.promises.unlink(newFilePath)
      }
    })
  })
})
