import inquirer from "inquirer";
import ora from "ora";

import { YoutrackService } from "../services";
import { colorize, isError } from "../utils";
import { COLORS } from "../consts";
import { TypeScriptService } from "../services/typescript.service";

/**
 * Command handler for generating TypeScript definitions for YouTrack projects
 * @param projects List of project short names or IDs
 * @param options Command options
 */
export const typesCommand = async (projects: string[] = [], { host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)
  const typescriptService = new TypeScriptService(youtrack)

  const projectIds: string[] = [];
  try {    
    // Get all available projects from YouTrack
    const existingProjects = await youtrack.fetchProjects();

    if (!existingProjects.length) {
      console.log(colorize("No projects available in YouTrack", COLORS.FG.RED));
      return;
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
            value: id 
          })),
        },
      ]);

      if (!selected.projects || selected.projects.length === 0) {
        console.log(colorize("No projects selected", COLORS.FG.YELLOW));
        return;
      }

      projectIds.push(...selected.projects);
    } else {
      // Map project names/short names to project IDs
      for (const projectName of projects) {
        const project = existingProjects.find(
          ({ name, shortName }) => name === projectName || shortName === projectName
        );
        
        if (project) {
          projectIds.push(project.id);
        } else {
          console.log(colorize(`Project '${projectName}' not found`, COLORS.FG.YELLOW));
        }
      }

      if (projectIds.length === 0) {
        console.log(colorize("No valid projects found", COLORS.FG.RED));
        return;
      }
    }
  } catch (error) {
    console.error(colorize("Error fetching available projects:", COLORS.FG.RED), error);
    return;
  }

  const spinner = ora({
    text: "Generating type definitions...",
    color: "blue",
  }).start();

  let successCount = 0;
  let failCount = 0;

  for (const projectId of projectIds) {
    try {
      const result = await typescriptService.generateTypeDefinitions(projectId);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error(colorize(`Error generating types for project ${projectId}:`, COLORS.FG.RED), error);
      failCount++;
    }

    // Update spinner text with progress
    spinner.text = `Generating type definitions (${successCount + failCount}/${projectIds.length})...`;
  }

  // Stop spinner and show results
  spinner.stop();

  if (successCount > 0) {
    console.log(colorize(`✅ Successfully generated type definitions for ${successCount} project(s)`, COLORS.FG.GREEN));
  }
  
  if (failCount > 0) {
    console.log(colorize(`❌ Failed to generate type definitions for ${failCount} project(s)`, COLORS.FG.RED));
  }

}
