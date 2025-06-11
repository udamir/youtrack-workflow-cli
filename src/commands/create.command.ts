import inquirer from "inquirer"

import { createWorkflowRule, isManifestExists } from "../tools/fs.tools"
import { ProjectService, YoutrackService } from "../services"
import { TEMPLATES } from "../templates"
import { isError, tryCatch } from "../utils"

/**
 * Command to create a new workflow rule from a template
 * @returns Results of the command execution
 */
export const createCommand = async (
  workflowArg: string,
  ruleNameArg: string,
  templateNameArg: string,
  { host = "", token = "" } = {},
): Promise<void> => {
  // Check if host and token are provided
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  try {
    // Create services
    const youtrackService = new YoutrackService(host, token)
    const projectService = new ProjectService(youtrackService)

    // Initialize local variables with argument values
    let workflow = workflowArg
    let ruleName = ruleNameArg
    let templateName = templateNameArg

    // Handle interactive mode if no workflow, ruleName, or templateName was provided
    if (!workflow) {
      // Get available workflows from the project
      const [projectWorkflows, error] = await tryCatch(projectService.projectWorkflows())

      if (error) {
        console.error(error.message)
        return
      }

      if (!projectWorkflows || !projectWorkflows.length) {
        console.log("No workflows available in the project. Add workflows first.")
        return
      }

      // Prompt for workflow selection
      const selected = await inquirer.prompt<{ workflow: string }>([
        {
          type: "list",
          name: "workflow",
          message: "Select a workflow to add a rule to:",
          choices: projectWorkflows.map((w) => w.name),
        },
      ])

      workflow = selected.workflow
    } else if (!isManifestExists(workflow)) {
      console.log(`Workflow '${workflow}' does not exist locally. Adding new workflow directory.`)
    }

    // Get available templates
    const availableTemplates = Object.keys(TEMPLATES)

    if (availableTemplates.length === 0) {
      console.error("No templates available.")
      return
    }

    // Prompt for template selection if not provided
    if (!templateName) {
      const templatePrompt = await inquirer.prompt<{ template: string }>([
        {
          type: "list",
          name: "template",
          message: "Select a template for the new rule:",
          choices: availableTemplates,
        },
      ])

      templateName = templatePrompt.template
    } else if (!availableTemplates.includes(templateName)) {
      console.error(`Template '${templateName}' not found. Available templates: ${availableTemplates.join(", ")}`)
      return
    }

    // Prompt for rule name if not provided
    if (!ruleName) {
      const ruleNamePrompt = await inquirer.prompt<{ ruleName: string }>([
        {
          type: "input",
          name: "ruleName",
          message: "Enter a name for the new rule:",
          validate: (input) => {
            if (!input.trim()) return "Rule name cannot be empty"
            return true
          },
        },
      ])

      ruleName = ruleNamePrompt.ruleName
    }

    // Create the rule file from template
    const createdFile = await createWorkflowRule(workflow, ruleName, templateName)
    console.log(`Successfully created rule file: ${createdFile}`)
  } catch (error) {
    console.error("Error creating workflow rule:", error)
  }
}
