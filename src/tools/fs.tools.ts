import * as path from "node:path"
import * as fs from "node:fs"

import type { PackageJson, WorkflowFile } from "../types"
import { filesHash } from "./hash.tools"

/**
 * Read workflow files from a directory
 * @param sourcePath Source directory path
 * @returns Array of filename and file content buffer pairs
 */
export const readWorkflowFiles = async (sourcePath: string): Promise<WorkflowFile[]> => {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source path does not exist: ${sourcePath}`)
  }

  // Read files in the root folder only (no recursion)
  const files: WorkflowFile[] = []

  // Get all entries in the directory
  const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true })

  // Process only files (skip directories)
  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = path.join(sourcePath, entry.name)

      // Read and store the file content
      files.push({
        name: entry.name,
        file: await fs.promises.readFile(fullPath),
      })
    }
  }

  return files
}

/**
 * Write workflow files to a directory
 * @param files Array of filename and file content buffer pairs
 * @param targetPath Target directory path
 */
export const writeWorkflowFiles = async (files: WorkflowFile[], targetPath: string): Promise<void> => {
  // Create target directory if it doesn't exist
  await fs.promises.mkdir(targetPath, { recursive: true })

  // Write each file
  for (const { name, file } of files) {
    // Get full file path
    const filePath = path.join(targetPath, name)

    // Write the file
    await fs.promises.writeFile(filePath, file)
  }
}

/**
 * Calculate a hash for a workflow folder using the same content-based approach as workflowHash
 * This creates a more reliable hash by ignoring file metadata
 * @param folderPath Path to the workflow folder
 * @returns Hash string representing only the combined content of files
 */
export const workflowFolderHash = async (folderPath: string): Promise<string> => {
  // Read files in the root folder only (no recursion)
  const files = await readWorkflowFiles(folderPath)

  // Calculate files hash
  return filesHash(files)
}

/**
 * Read package.json file
 * @param path Path to the package.json file
 * @returns Package.json content as a Record
 */
export const readPackageJson = (path: string): PackageJson => {
  const data = fs.readFileSync(path, "utf-8")
  return JSON.parse(data)
}

/**
 * Write package.json file
 * @param path Path to the package.json file
 * @param data Package.json content as a Record
 */
export const writePackageJson = (path: string, data: PackageJson): void => {
  fs.writeFileSync(path, JSON.stringify(data, null, 2))
}
