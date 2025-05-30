import { YoutrackService } from "../../src/services/youtrack.service"
import { TestHelper } from "./test-helpers"
import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

describe("YoutrackService Integration", () => {
  let helper: TestHelper
  let service: YoutrackService

  // Generate a unique test identifier
  const timestamp = Date.now()
  const randomSuffix = crypto.randomBytes(4).toString("hex")

  beforeAll(async () => {
    helper = new TestHelper()
    await helper.setup()

    const youtrackHost = process.env.YOUTRACK_BASE_URL || ""
    const youtrackToken = process.env.YOUTRACK_TOKEN || ""

    service = new YoutrackService(youtrackHost, youtrackToken)
  }, 30000) // Allow 30 seconds for setup

  afterAll(async () => {
    await helper.cleanup()
  })

  describe("fetchWorkflows", () => {
    it("should fetch available workflows from YouTrack", async () => {
      // Act
      const workflows = await service.fetchWorkflows()

      // Assert
      expect(workflows).toBeDefined()
      expect(Array.isArray(workflows)).toBe(true)

      // Display available workflows for debugging
      console.log(`Available workflows: ${workflows.join(", ")}`)
    })
  })

  describe("workflow structure examination", () => {
    it("should download and examine a workflow structure", async () => {
      // Skip test if no workflows available
      const workflows = await service.fetchWorkflows()
      if (!workflows || workflows.length === 0) {
        console.log("No workflows available for testing, skipping test")
        return
      }

      // Download an existing workflow
      const existingWorkflow = workflows[0] // Use the first available workflow
      console.log(`Using existing workflow: ${existingWorkflow} for test`)

      // Fetch workflow files from YouTrack
      const workflowFiles = await service.fetchWorkflow(existingWorkflow.name)
      expect(workflowFiles).toBeDefined()
      expect(Array.isArray(workflowFiles)).toBe(true)
      expect(workflowFiles?.length).toBeGreaterThan(0)

      // Log the workflow file structure
      console.log("Workflow files:")
      workflowFiles?.forEach((file) => {
        console.log(`- ${file.name}: ${file.file.length} bytes`)
      })

      // Find the workflow script files
      const scriptFiles = workflowFiles?.filter((f) => f.name.endsWith(".js"))
      expect(scriptFiles?.length).toBeGreaterThan(0)

      // Examine one script file
      if (scriptFiles && scriptFiles.length > 0) {
        const scriptFile = scriptFiles[0]
        const scriptContent = scriptFile.file.toString()
        console.log(`Script file ${scriptFile.name} content preview (first 100 chars):`)
        console.log(`${scriptContent.slice(0, 100)}...`)

        // Check for expected JS patterns in the workflow script
        expect(scriptContent).toMatch(/exports\.|module\.exports/)
      }

      // Try to identify the entry point (if package.json exists)
      const packageJson = workflowFiles?.find((f) => f.name === "package.json")
      if (packageJson) {
        try {
          const packageData = JSON.parse(packageJson.file.toString())
          console.log("Package.json data:", {
            name: packageData.name,
            version: packageData.version,
            main: packageData.main,
          })

          if (packageData.main) {
            console.log(`Entry point is: ${packageData.main}`)
          }
        } catch (e) {
          console.error("Failed to parse package.json")
        }
      }
    }, 60000) // Allow 1 minute for this test

    it("should verify the structure of a workflow directory", async () => {
      // Skip test if no workflows available
      const workflows = await service.fetchWorkflows()
      if (!workflows || workflows.length === 0) {
        console.log("No workflows available for testing, skipping test")
        return
      }

      // Download an existing workflow
      const existingWorkflow = workflows[0] // Use the first available workflow
      console.log(`Using workflow "${existingWorkflow}" for structure verification test`)

      // Create local workflow directory for testing
      const workflowDir = path.join(process.cwd(), `test-${timestamp}-${randomSuffix}`)
      await fs.promises.mkdir(workflowDir, { recursive: true })

      try {
        // Fetch workflow files from YouTrack
        const workflowFiles = await service.fetchWorkflow(existingWorkflow.name)

        // Verify workflow files were fetched successfully
        expect(workflowFiles).toBeDefined()
        expect(Array.isArray(workflowFiles)).toBe(true)
        expect(workflowFiles?.length).toBeGreaterThan(0)

        // Log the files for debugging
        console.log(`Retrieved ${workflowFiles?.length} files for workflow "${existingWorkflow}"`)
        workflowFiles?.forEach((file) => {
          console.log(`- ${file.name}: ${file.file.length} bytes`)
        })

        // Save files to the test directory
        for (const file of workflowFiles || []) {
          const filePath = path.join(workflowDir, file.name)
          await fs.promises.writeFile(filePath, file.file)
        }

        // Verify files were saved
        const dirContents = await fs.promises.readdir(workflowDir)
        expect(dirContents.length).toBe(workflowFiles?.length)

        // For real workflows, we expect certain patterns, but we'll avoid hard assertions
        // since we're working with real data that might have different structures
        const hasPackageJson = dirContents.includes("package.json")
        const hasJsFiles = dirContents.some((file) => file.endsWith(".js"))

        console.log(`Workflow structure check:
          - Has package.json: ${hasPackageJson ? "Yes" : "No"}
          - Has JS files: ${hasJsFiles ? "Yes" : "No"}
          - Total files: ${dirContents.length}
        `)

        // If there's a workflow file, examine its content
        const jsFiles = dirContents.filter((file) => file.endsWith(".js"))
        if (jsFiles.length > 0) {
          const jsFilePath = path.join(workflowDir, jsFiles[0])
          const jsContent = await fs.promises.readFile(jsFilePath, "utf8")
          console.log(`JS file content preview (${jsFiles[0]}, first 100 chars):`)
          console.log(`${jsContent.slice(0, 100)}...`)
        }
      } finally {
        // Clean up - remove test directory
        await fs.promises.rm(workflowDir, { recursive: true, force: true })
      }
    }, 60000) // Allow 1 minute for this test
  })
})
