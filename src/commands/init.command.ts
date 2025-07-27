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
    let projectName: string
    while (true) {
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
      
      projectName = name.trim()
      break
    }

    // Step 2: Get YouTrack base URL
    let baseUrl: string
    while (true) {
      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'YouTrack base URL (e.g., https://youtrack.example.com):',
          validate: (input: string) => {
            const validation = projectInitService.validateBaseUrl(input)
            return validation === true ? true : validation
          }
        }
      ])
      
      baseUrl = url.trim()
      break
    }

    // Step 3: Get YouTrack token
    let token: string
    while (true) {
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
      break
    }

    // Step 4: Validate credentials
    let credentialsValid = false
    let retryCount = 0
    const maxRetries = 3

    while (!credentialsValid && retryCount < maxRetries) {
      const spinner = ora('Validating credentials...').start()
      
      const validationResult = await projectInitService.validateCredentials(baseUrl, token)
      
      if (validationResult === true) {
        spinner.succeed('Credentials validated successfully')
        credentialsValid = true
      } else {
        spinner.fail(`Validation failed: ${validationResult}`)
        retryCount++
        
        if (retryCount < maxRetries) {
          console.log(`\nRetry ${retryCount}/${maxRetries - 1}. Please check your credentials.\n`)
          
          // Ask for new credentials
          const { retryChoice } = await inquirer.prompt([
            {
              type: 'list',
              name: 'retryChoice',
              message: 'What would you like to do?',
              choices: [
                { name: 'Re-enter base URL and token', value: 'both' },
                { name: 'Re-enter token only', value: 'token' },
                { name: 'Cancel initialization', value: 'cancel' }
              ]
            }
          ])

          if (retryChoice === 'cancel') {
            console.log('Initialization cancelled.')
            return
          }

          if (retryChoice === 'both') {
            // Re-enter base URL
            const { newUrl } = await inquirer.prompt([
              {
                type: 'input',
                name: 'newUrl',
                message: 'YouTrack base URL:',
                default: baseUrl,
                validate: (input: string) => {
                  const validation = projectInitService.validateBaseUrl(input)
                  return validation === true ? true : validation
                }
              }
            ])
            baseUrl = newUrl.trim()
          }

          // Re-enter token
          const { newToken } = await inquirer.prompt([
            {
              type: 'password',
              name: 'newToken',
              message: 'YouTrack token:',
              mask: '*',
              validate: (input: string) => {
                const validation = projectInitService.validateToken(input)
                return validation === true ? true : validation
              }
            }
          ])
          token = newToken.trim()
        } else {
          console.log('\nMaximum retry attempts reached. Please check your credentials and try again.')
          return
        }
      }
    }

    // Step 5: Ask about TypeScript support
    const { useTypeScript } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useTypeScript',
        message: 'Configure TypeScript support?',
        default: true
      }
    ])

    // Step 6: Create project
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

    // Step 7: Display success message and next steps
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
