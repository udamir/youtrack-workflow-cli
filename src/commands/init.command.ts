import inquirer from 'inquirer'
import ora from 'ora'

import { ProjectInitService } from '../services/project-init.service'
import type { ProjectConfig } from '../templates/project-templates'
import { printNewVersionWarning, tryCatch } from '../utils'

/**
 * Command to initialize a new YouTrack workflow project
 * @returns Results of the command execution
 */
export const initCommand = async (): Promise<void> => {
  await printNewVersionWarning()

  console.log('🚀 Initialize new YouTrack workflow project\n')

  const projectInitService = new ProjectInitService()

  try {
    // Step 1: Get project name
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: (input: string) => {
          const validation = projectInitService.validateProjectName(input)
          return validation === true ? true : validation
        }
      }
    ])
    const projectName = name.trim()

    // Step 2: Get credentials and validate
    let baseUrl = ''
    let token = ''
    let credentialsValid = false
    let retryCount = 0
    let isFirstRun = true
    const maxRetries = 3

    while (!credentialsValid && retryCount < maxRetries) {
      // Get YouTrack base URL
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'YouTrack base URL (leave empty to skip, e.g., https://youtrack.example.com):',
          default: isFirstRun ? '' : baseUrl,
          validate: (input: string) => {
            const trimmedInput = input.trim()
            // Allow empty input to skip validation
            if (trimmedInput === '') {
              return true
            }
            const validation = projectInitService.validateBaseUrl(trimmedInput)
            return validation === true ? true : validation
          }
        }
      ])
      
      baseUrl = url.trim()
      
      // Skip validation and token input if baseUrl is empty
      if (baseUrl === '') {
        token = ''
        console.log('⏭️  Skipping credential validation since base URL is empty')
        credentialsValid = true
        break
      }
      
      // Get YouTrack token
      const { userToken } = await inquirer.prompt([
        {
          type: 'password',
          name: 'userToken',
          message: 'YouTrack token (starts with "perm:"):',
          mask: '*',
          validate: (input: string) => {
            const validation = projectInitService.validateToken(input)
            return validation === true ? true : validation
          }
        }
      ])
      
      token = userToken.trim()
      
      // Validate credentials
      const spinner = ora('Validating credentials...').start()
      
      const validationResult = await projectInitService.validateCredentials(baseUrl, token)
      
      if (validationResult === true) {
        spinner.succeed('Credentials validated successfully')
        credentialsValid = true
      } else {
        spinner.fail(`Validation failed: ${validationResult}`)
        retryCount++
        
        if (retryCount < maxRetries) {
          console.log(`\nRetry ${retryCount}/${maxRetries}. Please check your credentials.\n`)
          isFirstRun = false // Set to false for subsequent runs
        } else {
          console.log('\nMaximum retry attempts reached. Please check your credentials and try again.')
          return
        }
      }
    }

    // Step 3: Ask about TypeScript support
    const { useTypeScript } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useTypeScript',
        message: 'Configure TypeScript support?',
        default: true
      }
    ])

    // Step 4: Create project
    const config: ProjectConfig = {
      projectName,
      baseUrl,
      token,
      useTypeScript
    }

    const spinner = ora('Creating project structure...').start()
    
    const [, error] = await tryCatch(projectInitService.initializeProject(config))
    
    if (error) {
      spinner.fail('Failed to create project')
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return
    }

    spinner.succeed('Project created successfully!')

    // Step 5: Display success message and next steps
    console.log(`\n✅ Project "${projectName}" has been initialized!\n`)
    console.log('📁 Created files:')
    console.log('   ├── .env (with your credentials)')
    console.log('   ├── .gitignore')
    console.log('   ├── README.md')
    console.log('   ├── package.json')
    console.log('   ├── eslint.config.cjs')
    console.log('   ├── biome.json')
    
    if (useTypeScript) {
      console.log('   ├── tsconfig.json')
      console.log('   └── types/')
      console.log('       └── customTypes.d.ts')
    }

    console.log('\n🚀 Next steps:')
    console.log(`   1. cd ${projectName}`)
    console.log('   2. npm install')
    console.log('   3. npx ytw list (verify connection)')
    console.log('   4. npx ytw add (add your first workflow)')
    console.log('\n📖 See README.md for detailed usage instructions.')

  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`)
    } else {
      console.error('\nAn unexpected error occurred during initialization.')
    }
  }
}
