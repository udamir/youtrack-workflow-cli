import * as crypto from "node:crypto"

import type { WorkflowFile } from "../types"

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
 * @returns Combined hash of all files
 */
export const filesHash = (files: WorkflowFile[]): string => {
  const fileHashes = files.map(({ name, file }) => `${name}:${calculateHash(file)}`)

  // Sort hashes by filename to ensure consistent order
  const sortedFiles = [...fileHashes].sort((a, b) => a.localeCompare(b))

  // Create a combined string of all file hashes
  const combinedHashes = sortedFiles.join("|")

  // Calculate final hash of the combined string
  return calculateHash(Buffer.from(combinedHashes))
}
