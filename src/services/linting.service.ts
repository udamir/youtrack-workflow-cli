import { execSync } from "node:child_process"
import type { ESLint } from "eslint"

import { fileExists, readPackageJson } from "../tools/fs.tools"
import type { LintingConfig, LintingResult } from "../types"

type LintingServiceConfig = {
  enableEslint?: boolean
  enableTypeCheck?: boolean
  maxWarnings?: number
}

export class LintingService {
  public readonly config: LintingConfig

  constructor({ enableEslint, enableTypeCheck, maxWarnings }: LintingServiceConfig = {}) {
    const { linting } = readPackageJson().ytw

    const esLintConfig = fileExists("eslint.config.js")

    this.config = {
      enableEslint: linting?.enableEslint ?? enableEslint ?? esLintConfig ?? false,
      enableTypeCheck: linting?.enableTypeCheck ?? enableTypeCheck ?? false,
      maxWarnings: linting?.maxWarnings ?? maxWarnings ?? 10,
    }
  }

  public async lintWorkflow(workflowName: string): Promise<LintingResult> {
    const results: LintingResult = {
      errors: [],
      warnings: [],
    }

    // Apply ESLint if enabled
    if (this.config.enableEslint) {
      try {
        const eslintResult = await this.runEslint(workflowName)
        results.errors.push(...eslintResult.errors)
        results.warnings.push(...eslintResult.warnings)
      } catch (error: any) {
        results.errors.push(`${workflowName}: ESLint error: ${error.message}`)
      }
    }

    // Apply TypeScript checking if enabled
    if (this.config.enableTypeCheck) {
      const typeCheckResult = await this.runTypeCheck(workflowName)
      results.errors.push(...typeCheckResult.errors)
      results.warnings.push(...typeCheckResult.warnings)
    }

    // Check warning limits for the entire workflow
    if (this.config.maxWarnings && results.warnings.length > this.config.maxWarnings) {
      results.errors.push(
        `${workflowName}: Exceeded maximum allowed warnings (${this.config.maxWarnings}) in workflow: ${workflowName}`,
      )
    }

    return results
  }

  private async runEslint(workflowName: string): Promise<LintingResult> {
    const result: LintingResult = {
      errors: [],
      warnings: [],
    }

    let execResult: string

    // Use npx to run ESLint without installing it globally
    try {
      execResult = execSync(`npx --no-install eslint --format json "${workflowName}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
    } catch (error: any) {
      execResult = error.stdout?.toString() || error.stderr?.toString() || ""
    }

    try {
      const eslintOutput = JSON.parse(execResult) as ESLint.LintResult[]
      if (!Array.isArray(eslintOutput)) {
        throw new Error("Invalid ESLint output format")
      }
      return eslintOutput.reduce((acc: LintingResult, result: ESLint.LintResult): LintingResult => {
        // Remove project path from file path
        const relativePath = result.filePath.replace(`${process.cwd()}/`, "")

        for (const msg of result.messages) {
          const message = `${relativePath}(${msg.line},${msg.column}): eslint ${msg.ruleId}: ${msg.message}`
          if (msg.severity === 2) {
            acc.errors.push(message)
          } else if (msg.severity === 1) {
            acc.warnings.push(message)
          }
        }

        return acc
      }, result)
    } catch (_parseError: any) {
      return {
        errors: [`${workflowName}: Error parsing ESLint output: ${execResult || "Unknown error"}`],
        warnings: [],
      }
    }
  }

  private async runTypeCheck(workflowName: string): Promise<LintingResult> {
    try {
      // Run TypeScript using npx to ensure we use the local installation
      execSync(`npx --no-install tsc --noEmit --allowJs --checkJs --pretty false ${workflowName}/*.js`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })

      return { errors: [], warnings: [] } // No output means no errors
    } catch (execError: any) {
      // TypeScript compiler errors
      const output = execError.stdout?.toString() || execError.stderr?.toString() || ""

      // Split the output into lines and filter those referring to the target file
      return { errors: output.split("\n").filter(Boolean), warnings: [] }
    }
  }
}
