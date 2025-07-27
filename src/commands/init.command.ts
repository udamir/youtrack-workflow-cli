import inquirer from "inquirer"
import ora from "ora"

import { ProjectInitService } from "../services/project-init.service"
import type { ProjectConfig } from "../templates/project-templates"
import { printNewVersionWarning, tryCatch } from "../utils"

/**
 * Options for the init command
 */
interface InitCommandOptions {
  host?: string
  token?: string
  typescript?: boolean
}

/**
 * Command to initialize a new YouTrack workflow project
 * @param projectName Project name
 * @param options Command line options
 * @returns Results of the command execution
 */
export const initCommand = async (_projectName?: string, options: InitCommandOptions = {}): Promise<void> => {
  await printNewVersionWarning()

  console.log("🚀 Initialize new YouTrack workflow project\n")

  // Step 1: Get project name
  let projectName = _projectName
  let baseUrl = options.host || ""
  let token = options.token || ""
  let credentialsValid = false
  let retryCount = 0
  let isFirstRun = true
  const maxRetries = 3

  const projectInitService = new ProjectInitService()

  // If credentials are provided via options, validate them first
  if (options.host && options.token) {
    const hostValidation = projectInitService.validateBaseUrl(options.host)
    if (hostValidation !== true) {
      console.error(`Error: ${hostValidation}`)
      return
    }

    const tokenValidation = projectInitService.validateToken(options.token)
    if (tokenValidation !== true) {
      console.error(`Error: ${tokenValidation}`)
      return
    }

    baseUrl = options.host
    token = options.token
  }

  if (!projectName) {
    const { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Project name:",
        validate: (input: string) => {
          const validation = projectInitService.validateProjectName(input)
          return validation === true ? true : validation
        },
      },
    ])
    projectName = name.trim()
  } else {
    // Validate provided project name
    const validation = projectInitService.validateProjectName(projectName)
    if (validation !== true) {
      console.error(`Error: ${validation}`)
      return
    }
  }

  while (!credentialsValid && retryCount < maxRetries) {
    // Get YouTrack base URL if not provided
    if (!baseUrl && !options.host) {
      const { url } = await inquirer.prompt([
        {
          type: "input",
          name: "url",
          message: "YouTrack base URL (leave empty to skip, e.g., https://youtrack.example.com):",
          default: isFirstRun ? "" : baseUrl,
          validate: (input: string) => {
            const trimmedInput = input.trim()
            // Allow empty input to skip validation
            if (trimmedInput === "") {
              return true
            }
            const validation = projectInitService.validateBaseUrl(trimmedInput)
            return validation === true ? true : validation
          },
        },
      ])
      baseUrl = url.trim()
    }

    // Skip validation and token input if baseUrl is empty
    if (baseUrl === "") {
      token = ""
      console.log("⏭️  Skipping credential validation since base URL is empty")
      credentialsValid = true
      break
    }

    // Get YouTrack token if not provided
    if (!token && !options.token) {
      const { userToken } = await inquirer.prompt([
        {
          type: "password",
          name: "userToken",
          message: 'YouTrack token (starts with "perm"):',
          mask: "*",
          validate: (input: string) => {
            const validation = projectInitService.validateToken(input)
            return validation === true ? true : validation
          },
        },
      ])
      token = userToken.trim()
    }

    // Validate credentials
    const spinner = ora("Validating credentials...").start()

    const validationResult = await projectInitService.validateCredentials(baseUrl, token)

    if (validationResult === true) {
      spinner.succeed("Credentials validated successfully")
      credentialsValid = true
    } else {
      spinner.fail(`Validation failed: ${validationResult}`)
      retryCount++

      if (retryCount < maxRetries) {
        console.log(`\nRetry ${retryCount}/${maxRetries}. Please check your credentials.\n`)
        isFirstRun = false // Set to false for subsequent runs
      } else {
        console.log("\nMaximum retry attempts reached. Please check your credentials and try again.")
        return
      }
    }
  }

  // Step 3: Ask about TypeScript support
  let useTypeScript: boolean

  if (options.typescript !== undefined) {
    useTypeScript = options.typescript
  } else {
    const result = await inquirer.prompt([
      {
        type: "confirm",
        name: "useTypeScript",
        message: "Configure TypeScript support?",
        default: true,
      },
    ])
    useTypeScript = result.useTypeScript
  }

  // Step 4: Create project
  if (!projectName) {
    console.error("Error: Project name is required")
    return
  }

  const config: ProjectConfig = {
    projectName: projectName,
    baseUrl: baseUrl || "", // Default to empty string if not provided
    token: token || "", // Default to empty string if not provided
    useTypeScript,
  }

  const spinner = ora("Creating project structure...").start()

  const [, error] = await tryCatch(projectInitService.initializeProject(config))

  if (error) {
    spinner.fail("Failed to create project")
    console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return
  }

  spinner.succeed("Project created successfully!")

  // Step 5: Display success message and next steps
  console.log(`\n✅ Project "${projectName}" has been initialized!\n`)
  console.log("📁 Created files:")
  console.log("   ├── .env (with your credentials)")
  console.log("   ├── .gitignore")
  console.log("   ├── README.md")
  console.log("   ├── package.json")
  console.log("   ├── eslint.config.cjs")

  if (useTypeScript) {
    console.log("   ├── tsconfig.json")
    console.log("   └── types/ (empty - use `npx ytw types` to generate definitions)")
  }

  console.log("\n🚀 Next steps:")
  console.log(`   1. cd ${projectName}`)
  console.log("   2. npm install")
  console.log("   3. npx ytw list (verify connection)")
  if (useTypeScript) {
    console.log("   4. npx ytw types (generate type definitions)")
    console.log("   5. npx ytw add (add your first workflow)")
  } else {
    console.log("   4. npx ytw add (add your first workflow)")
  }
  console.log("\n📖 See README.md for detailed usage instructions.")
}
