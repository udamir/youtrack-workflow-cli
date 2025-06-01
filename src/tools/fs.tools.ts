import * as fs from "node:fs"
import * as path from "node:path"

import type { LockFileData, WorkflowFile, WorkflowHash, YtwConfig } from "../types"
import { calculateWorkflowHash } from "./hash.tools"
import { LOCK_FILE_NAME } from "../consts"

/**
 * Get the path to the workflow directory
 * @param workflowName Workflow name
 * @returns Path to the workflow directory
 */
export const getWorkflowPath = (workflowName: string): string => {
  return path.join(process.cwd(), workflowName)
}

/**
 * Get the path to the lock file
 * @returns Path to the lock file
 */
export const getLockFilePath = (): string => {
  return path.join(process.cwd(), LOCK_FILE_NAME)
}

/**
 * Check if a file exists
 * @param fileName File name
 * @returns True if the file exists, false otherwise
 */
export const fileExists = (fileName: string): boolean => {
  return fs.existsSync(path.join(process.cwd(), fileName))
}

/**
 * Check if a folder exists
 * @param folderName Folder name
 * @returns True if the folder exists, false otherwise
 */
export const folderExists = (folderName: string): boolean => {
  return fs.existsSync(path.join(process.cwd(), folderName))
}

/**
 * Read configuration from package.json
 * @returns Configuration object
 */
export const readPackageJson = (): { version: string; ytw: YtwConfig } => {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return { version: "", ytw: { linting: {} } }
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  return { version: packageJson.version, ytw: packageJson.ytw ?? { linting: {} } }
}

/**
 * Check if a workflow is local
 * @param workflowName Workflow name
 * @returns True if the workflow is local, false otherwise
 */
export const isLocalWorkflow = (workflowName: string): boolean => {
  const manifestPath = path.join(process.cwd(), workflowName, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    return false
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  return manifest.name === workflowName
}

/**
 * Read workflow files from a directory
 * @param workflowName Workflow name
 * @returns Array of filename and file content buffer pairs
 */
export const readLocalWorkflowFiles = async (workflowName: string): Promise<WorkflowFile[]> => {
  const sourcePath = getWorkflowPath(workflowName)

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
 * Read a specific workflow file from a directory
 * @param workflowName Workflow name
 * @param fileName File name
 * @returns File content in string
 */
export const readLocalWorkflowFile = async (workflowName: string, fileName: string): Promise<string> => {
  const sourcePath = getWorkflowPath(workflowName)
  const fullPath = path.join(sourcePath, fileName)
  return fs.promises.readFile(fullPath, "utf-8")
}

/**
 * Delete workflow files from a directory
 * @param workflowName Workflow name
 */
export const deleteLocalWorkflowFiles = async (workflowName: string): Promise<void> => {
  const targetPath = getWorkflowPath(workflowName)

  // Delete the directory and its contents
  await fs.promises.rm(targetPath, { recursive: true, force: true })
}

/**
 * Write workflow files to a directory
 * @param files Array of filename and file content buffer pairs
 * @param workflowName Workflow name
 */
export const writeLocalWorkflowFiles = async (files: WorkflowFile[], workflowName: string): Promise<void> => {
  const targetPath = getWorkflowPath(workflowName)

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
 * @param workflowName Workflow name
 * @returns Hash string representing only the combined content of files
 */
export const localWorkflowFolderHash = async (workflowName: string): Promise<WorkflowHash> => {
  // Read files in the root folder only (no recursion)
  const files = await readLocalWorkflowFiles(workflowName)

  // Calculate files hash
  return calculateWorkflowHash(files)
}

/**
 * Read lock file
 * @returns Lock file data or empty data if file doesn't exist
 */
export const readLockFile = (): LockFileData => {
  const lockFilePath = getLockFilePath()

  try {
    const data = fs.readFileSync(lockFilePath, "utf-8")
    return JSON.parse(data) as LockFileData
  } catch (error) {
    // If file doesn't exist or can't be parsed, return empty data
    return {
      workflows: {},
    }
  }
}

/**
 * Write lock file data to disk
 * @param data Lock file data
 */
export const writeLockFile = (data: LockFileData): void => {
  const lockFilePath = getLockFilePath()

  try {
    // Ensure the lock file is formatted consistently
    const formattedData = JSON.stringify(data, null, 2)
    fs.writeFileSync(lockFilePath, formattedData, "utf-8")
  } catch (error) {
    throw new Error(`Failed to write lock file: ${(error as Error).message}`)
  }
}

/**
 * Check if a workflow manifest exists
 * @param workflowName Workflow name
 * @returns True if the manifest exists, false otherwise
 */
export const isManifestExists = (workflowName: string): boolean => {
  return fs.existsSync(path.join(getWorkflowPath(workflowName), "manifest.json"))
}


/**
 * Write type definition file to disk
 * @param projectName Project name
 * @param content Type definition content
 */
export const writeTypeFile = async (projectName: string, content: string): Promise<void> => {
  // Create the types directory if it doesn't exist
  const typesDir = path.resolve(process.cwd(), 'types');
  await fs.promises.mkdir(typesDir, { recursive: true });
  
  // Write the type definition file
  const typeFilePath = path.resolve(typesDir, `${projectName.toLowerCase()}.d.ts`);
  await fs.promises.writeFile(typeFilePath, content);
}
