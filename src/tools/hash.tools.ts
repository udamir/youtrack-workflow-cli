import * as crypto from "node:crypto"

import type { WorkflowFile, WorkflowHash } from "../types"

/**
 * Calculate MD5 hash of a buffer
 * @param buffer Buffer to hash
 * @returns Hex-encoded hash
 */
export const calculateHash = (buffer: Buffer): string => {
  return crypto.createHash("md5").update(buffer).digest("hex")
}

/**
 * Calculate a hash for a collection of files based on their names and content hashes
 * @param files Array of filename and hash pairs
 * @returns Workflow hash and individual file hashes
 */
export const calculateWorkflowHash = (files: WorkflowFile[]): WorkflowHash => {
  const fileHashes = files.reduce(
    (acc, { name, file }) => {
      acc[name] = calculateHash(file)
      return acc
    },
    {} as Record<string, string>,
  )

  // Sort hashes by filename to ensure consistent order
  const workflowFileHashes = Object.entries(fileHashes)
    .map(([name, hash]) => `${name}:${hash}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|")

  // Calculate final hash of the combined string
  return {
    hash: calculateHash(Buffer.from(workflowFileHashes)),
    fileHashes: fileHashes,
  }
}
