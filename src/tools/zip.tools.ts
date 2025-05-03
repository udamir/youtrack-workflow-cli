import JSZip from "jszip"

import type { WorkflowFile } from "../types"
import { filesHash } from "./hash.tools"

/**
 * Calculate a hash for a workflow zip based only on file contents
 * This creates a more reliable hash by ignoring zip metadata
 * @param zipBuffer Zip file buffer
 * @returns Hash string representing only the combined content of files
 */
export const workflowHash = async (zipBuffer: Buffer): Promise<string> => {
  // Extract files with their content
  const files = await extractFilesFromZip(zipBuffer)

  // Calculate files hash
  return filesHash(files)
}

/**
 * Extract files from a zip buffer
 * @param zipBuffer Zip file buffer
 * @returns Array of filename and file content buffer pairs
 */
export const extractFilesFromZip = async (zipBuffer: Buffer): Promise<WorkflowFile[]> => {
  // Load the zip file
  const zip = await JSZip.loadAsync(zipBuffer)

  // Extract files with their content
  const files: WorkflowFile[] = []

  for (const [fileName, file] of Object.entries(zip.files)) {
    // Get file content
    files.push({
      name: fileName,
      file: await file.async("nodebuffer"),
    })
  }

  return files
}

/**
 * Archive workflow files into a zip buffer
 * @param files Array of filename and file content buffer pairs
 * @returns Workflow zip file buffer
 */
export const archiveWorkflow = async (files: WorkflowFile[]): Promise<Buffer> => {
  const zip = new JSZip()

  for (const { name, file } of files) {
    zip.file(name, file)
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })
  return zipBuffer
}
