import { YoutrackService } from "../services"
import { colorize, isError } from "../utils"
import { COLORS } from "../consts"

/**
 * Command handler for listing available workflows
 * @param options Command options
 */
export const listCommand = async ({ host = "", token = "" } = {}): Promise<void> => {
  if (isError(!token, "YOUTRACK_TOKEN is not defined")) {
    return
  }
  if (isError(!host, "YOUTRACK_BASE_URL is not defined")) {
    return
  }

  const youtrack = new YoutrackService(host, token)

  try {
    const workflows = await youtrack.fetchWorkflows()

    if (workflows.length === 0) {
      console.log("No workflows found.")
      return
    }

    console.log(colorize("Available workflows:", COLORS.STYLE.BRIGHT))
    for (const workflow of workflows) {
      console.log(`${colorize("•", COLORS.FG.CYAN)} ${workflow.name}`)
    }

    console.log(`\n${colorize(`Total: ${workflows.length} workflows`, COLORS.FG.GREEN)}`)
  } catch (error) {
    console.error(`${colorize("Error:", COLORS.FG.RED)} listing workflows:`, error)
  }
}
