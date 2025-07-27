import type { ProjectConfig } from '../templates/project-templates'
import { PROJECT_TEMPLATES } from '../templates/project-templates'
import {
  createProjectDirectory,
  createProjectFile,
  createProjectJsonFile,
  createTypesDirectory
} from '../tools/fs.tools'
import { YoutrackService } from './youtrack/youtrack.service'
import { tryCatch } from '../utils'

/**
 * Service for initializing new YouTrack workflow projects
 */
export class ProjectInitService {
  /**
   * Validate YouTrack credentials by attempting to fetch workflows
   * @param baseUrl YouTrack base URL
   * @param token YouTrack token
   * @returns True if credentials are valid, error message if not
   */
  async validateCredentials(baseUrl: string, token: string): Promise<true | string> {
    try {
      const youtrackService = new YoutrackService(baseUrl, token)
      const [, error] = await tryCatch(youtrackService.fetchWorkflows())
      
      if (error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          return 'Invalid token. Please check your YouTrack token.'
        }
        if (error.message.includes('404') || error.message.includes('Not Found')) {
          return 'Invalid base URL. Please check your YouTrack instance URL.'
        }
        return `Connection failed: ${error.message}`
      }
      
      return true
    } catch (error) {
      return `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  /**
   * Initialize a new YouTrack workflow project
   * @param config Project configuration
   * @returns Path to the created project
   */
  async initializeProject(config: ProjectConfig): Promise<string> {
    const { projectName, baseUrl, token, useTypeScript } = config

    // Create project directory
    const projectPath = await createProjectDirectory(projectName)

    try {
      // Create .env file
      const envContent = PROJECT_TEMPLATES.env(baseUrl, token)
      await createProjectFile(projectPath, '.env', envContent)

      // Create package.json
      const packageJsonData = PROJECT_TEMPLATES.packageJson(projectName, useTypeScript)
      await createProjectJsonFile(projectPath, 'package.json', packageJsonData)

      // Create configuration files
      const eslintContent = PROJECT_TEMPLATES.eslintConfig()
      await createProjectFile(projectPath, 'eslint.config.cjs', eslintContent)

      // Create documentation files
      const gitignoreContent = PROJECT_TEMPLATES.gitignore()
      await createProjectFile(projectPath, '.gitignore', gitignoreContent)

      const readmeContent = PROJECT_TEMPLATES.readme(projectName)
      await createProjectFile(projectPath, 'README.md', readmeContent)

      // Create TypeScript-specific files if enabled
      if (useTypeScript) {
        const tsconfigData = PROJECT_TEMPLATES.tsconfig()
        await createProjectJsonFile(projectPath, 'tsconfig.json', tsconfigData)
        
        await createTypesDirectory(projectPath)
      }

      return projectPath
    } catch (error) {
      // Clean up on failure - remove the created directory
      try {
        const fs = await import('node:fs')
        await fs.promises.rm(projectPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
      
      throw error
    }
  }

  /**
   * Validate project name format
   * @param projectName Project name to validate
   * @returns True if valid, error message if not
   */
  validateProjectName(projectName: string): true | string {
    if (!projectName || projectName.trim().length === 0) {
      return 'Project name cannot be empty'
    }

    const trimmedName = projectName.trim()
    
    // Check for valid characters (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      return 'Project name can only contain letters, numbers, hyphens, and underscores'
    }

    // Check length
    if (trimmedName.length > 50) {
      return 'Project name must be 50 characters or less'
    }

    // Check that it doesn't start with a hyphen or underscore
    if (trimmedName.startsWith('-') || trimmedName.startsWith('_')) {
      return 'Project name cannot start with a hyphen or underscore'
    }

    return true
  }

  /**
   * Validate YouTrack base URL format
   * @param baseUrl Base URL to validate
   * @returns True if valid, error message if not
   */
  validateBaseUrl(baseUrl: string): true | string {
    if (!baseUrl || baseUrl.trim().length === 0) {
      return 'Base URL cannot be empty'
    }

    const trimmedUrl = baseUrl.trim()

    try {
      const url = new URL(trimmedUrl)
      
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return 'Base URL must use http:// or https:// protocol'
      }

      if (!url.hostname) {
        return 'Base URL must include a valid hostname'
      }

      return true
    } catch {
      return 'Invalid URL format. Please include the full URL (e.g., https://youtrack.example.com)'
    }
  }

  /**
   * Validate YouTrack token format
   * @param token Token to validate
   * @returns True if valid, error message if not
   */
  validateToken(token: string): true | string {
    if (!token || token.trim().length === 0) {
      return 'Token cannot be empty'
    }

    const trimmedToken = token.trim()

    // Basic format check - YouTrack tokens typically start with 'perm:'
    if (!trimmedToken.startsWith('perm:')) {
      return 'Token should start with "perm:" (permanent token format)'
    }

    if (trimmedToken.length < 20) {
      return 'Token appears to be too short. Please check your token.'
    }

    return true
  }
}
