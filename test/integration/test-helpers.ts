import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import dotenv from "dotenv"

// Load environment variables from .env file
dotenv.config()

/**
 * Helper for YouTrack integration tests
 */
export class TestHelper {
  private testDir: string
  private originalEnv: NodeJS.ProcessEnv
  private originalCwd: string

  constructor() {
    this.originalEnv = { ...process.env }
    this.originalCwd = process.cwd()
    this.testDir = fs.mkdtempSync(path.join(os.tmpdir(), "youtrack-workflow-test-"))
  }

  /**
   * Set up the test environment
   */
  async setup(): Promise<void> {
    // Ensure we have the required environment variables
    if (!process.env.YOUTRACK_BASE_URL || !process.env.YOUTRACK_TOKEN) {
      throw new Error("YOUTRACK_BASE_URL and YOUTRACK_TOKEN must be set in .env file")
    }

    // Create test directory structure
    await fs.promises.mkdir(path.join(this.testDir, "workflows"), { recursive: true })

    // Create mock package.json for the test project
    await fs.promises.writeFile(
      path.join(this.testDir, "package.json"),
      JSON.stringify(
        {
          name: "test-project",
          version: "1.0.0",
          workflows: {},
        },
        null,
        2,
      ),
    )

    // Change working directory to the test directory
    process.chdir(this.testDir)

    // Mock console to capture output
    this.mockConsole()
  }

  /**
   * Clean up the test environment
   */
  async cleanup(): Promise<void> {
    // Restore environment
    process.env = this.originalEnv

    // Restore original working directory
    process.chdir(this.originalCwd)

    // Remove test directory
    try {
      await fs.promises.rm(this.testDir, { recursive: true, force: true })
    } catch (error) {
      console.error(`Error cleaning up test directory: ${error}`)
    }

    // Restore console
    this.restoreConsole()
  }

  /**
   * Get the test directory path
   */
  getTestDir(): string {
    return this.testDir
  }

  /**
   * Create a test workflow directory
   */
  async createWorkflowDir(workflowName: string): Promise<string> {
    const workflowDir = path.join(this.testDir, workflowName)
    await fs.promises.mkdir(workflowDir, { recursive: true })

    // Create a basic workflow package.json
    await fs.promises.writeFile(
      path.join(workflowDir, "package.json"),
      JSON.stringify(
        {
          name: workflowName,
          version: "1.0.0",
        },
        null,
        2,
      ),
    )

    // Create a basic workflow script
    await fs.promises.writeFile(path.join(workflowDir, "workflow.js"), `// Test workflow content for ${workflowName}`)

    // Create a manifest.json file which is required by isManifestExists check
    await fs.promises.writeFile(
      path.join(workflowDir, "manifest.json"),
      JSON.stringify(
        {
          name: workflowName,
          description: "Test workflow for integration tests",
          main: "workflow.js"
        },
        null,
        2
      )
    )

    return workflowDir
  }

  /**
   * Add a workflow to the test project's package.json
   */
  async addWorkflowToProject(workflowName: string, hash: string): Promise<void> {
    const pkgPath = path.join(this.testDir, "package.json")
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf-8"))

    if (!pkg.workflows) {
      pkg.workflows = {}
    }

    pkg.workflows[workflowName] = hash

    await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2))
  }

  // Console mocking for output capture
  private originalConsoleLog = console.log
  private originalConsoleError = console.error
  private consoleOutput: string[] = []
  private consoleErrors: string[] = []

  /**
   * Mock console methods to capture output
   */
  private mockConsole(): void {
    console.log = (...args: any[]) => {
      this.consoleOutput.push(args.join(" "))
    }
    console.error = (...args: any[]) => {
      this.consoleErrors.push(args.join(" "))
    }
  }

  /**
   * Restore original console methods
   */
  private restoreConsole(): void {
    console.log = this.originalConsoleLog
    console.error = this.originalConsoleError
  }

  /**
   * Get captured console output
   */
  getConsoleOutput(): string[] {
    return [...this.consoleOutput]
  }

  /**
   * Get captured console errors
   */
  getConsoleErrors(): string[] {
    return [...this.consoleErrors]
  }

  /**
   * Clear captured console output
   */
  clearConsoleOutput(): void {
    this.consoleOutput = []
    this.consoleErrors = []
  }
}
