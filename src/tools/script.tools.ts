import { spawn } from "node:child_process"

/**
 * Execute a script with provided parameters
 *
 * @param scriptCommand - Command to execute
 * @param args - Arguments to pass to the script
 * @returns Promise that resolves when script execution completes, or rejects on error
 */
export const executeScript = async (scriptCommand: string, ...args: string[]): Promise<string> => {
  if (!scriptCommand) {
    return ""
  }

  return new Promise<string>((resolve, reject) => {
    let output = ""
    let errorOutput = ""

    // Split the command into the command and its arguments
    const [cmd, ...cmdArgs] = scriptCommand.split(/\s+/)

    // Spawn the process with piped stdio to capture output
    const child = spawn(cmd, [...cmdArgs, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    })

    // Handle stdout
    child.stdout?.on("data", (data) => {
      const text = data.toString()
      output += text
    })

    // Capture stderr
    child.stderr?.on("data", (data) => {
      const text = data.toString()
      errorOutput += text
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(errorOutput))
      }
    })

    child.on("error", (err) => {
      reject(new Error(`${err.message}\n${errorOutput}`))
    })
  })
}
