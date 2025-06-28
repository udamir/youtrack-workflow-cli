import inquirer from "inquirer"
import ora from "ora"

import { colorize, isError, printNewVersionWarning, progressStatus, StatusCounter } from "../utils"
import { YoutrackService, TypeScriptService } from "../services"
import { printItemStatus } from "../tools/console.tools"
import { COLORS } from "../consts"

/**
 * Command handler for generating TypeScript definitions for YouTrack projects
 * @param projects List of project short names or IDs
 * @param options Command options
 */
export const typesCommand = async (projects: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  await printNewVersionWarning()

  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const typescriptService = new TypeScriptService(youtrack)

  const projectToProcess: { id: string; shortName: string }[] = []
  try {
    // Get all available projects from YouTrack
    const existingProjects = await youtrack.fetchProjects()

    if (!existingProjects.length) {
      console.log(colorize("No projects available in YouTrack", COLORS.FG.RED))
      return
    }

    if (!projects.length) {
      // Show prompt to select projects
      const selected = await inquirer.prompt([
        {
          type: "checkbox",
          name: "projects",
          message: "Select projects to generate type definitions for:",
          choices: existingProjects.map(({ name, shortName, id }) => ({
            name: `${name} (${shortName})`,
            value: { id, shortName },
          })),
        },
      ])

      if (!selected.projects || selected.projects.length === 0) {
        console.log(colorize("No projects selected", COLORS.FG.YELLOW))
        return
      }

      projectToProcess.push(...selected.projects)
    } else {
      // Map project names/short names to project IDs
      for (const projectName of projects) {
        const project = existingProjects.find(
          ({ name, shortName }) => name === projectName || shortName === projectName,
        )

        if (project) {
          projectToProcess.push({ id: project.id, shortName: project.shortName })
        } else {
          console.log(colorize(`Project '${projectName}' not found`, COLORS.FG.YELLOW))
        }
      }

      if (projectToProcess.length === 0) {
        console.log(colorize("No valid projects found", COLORS.FG.RED))
        return
      }
    }
  } catch (error) {
    console.error(colorize("Error fetching available projects:", COLORS.FG.RED), error)
    return
  }

  const counter = new StatusCounter()

  for (const { id, shortName } of projectToProcess) {
    const spinner = ora({
      text: `${shortName}: ...\nGenerating type definitions for project (${counter.total}/${projectToProcess.length})`,
      color: "blue",
    }).start()

    const result = await typescriptService.generateTypeDefinitions(id)

    // Stop spinner to print status line
    spinner.stop()

    printItemStatus(shortName, progressStatus(result.status), result.message)

    counter.inc(result.status)
  }

  console.log(
    `\nSuccessfully generated type definitions: ${counter.get("success")} (${counter.get("skipped")} skipped, ${counter.get("error")} failed)`,
  )
}
