/**
 * Base error class for YouTrack workflow CLI
 */
export class WorkflowError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a workflow could not be found
 */
export class WorkflowNotFoundError extends WorkflowError {
	constructor(workflowName: string) {
		super(`Workflow '${workflowName}' could not be found`);
	}
}

/**
 * Error thrown when a workflow already exists
 */
export class WorkflowExistsError extends WorkflowError {
	constructor(workflowName: string) {
		super(`Workflow '${workflowName}' already exists in the project`);
	}
}

/**
 * Error thrown when a workflow does not exist in the project
 */
export class WorkflowNotInProjectError extends WorkflowError {
	constructor(workflowName: string) {
		super(`Workflow '${workflowName}' doesn't exist in the project`);
	}
}

/**
 * Error thrown when there's an issue with the YouTrack API
 */
export class YouTrackApiError extends WorkflowError {
	public status: number;
	public responseText?: string;

	constructor(error: unknown, message: string, status = 500, responseText?: string) {
		super(message);
		if (error instanceof YouTrackApiError) {
			this.status = error.status;
			this.responseText = error.responseText;
		} else {
			this.status = status;
			if (!responseText && error instanceof Error) {
				this.responseText = error.message;
			} else {
				this.responseText = responseText || "Unknown error";
			}
		}
	}
}

/**
 * Error thrown when a file operation fails
 */
export class FileOperationError extends WorkflowError {
	constructor(
		message: string,
		public readonly path: string,
		public readonly originalError?: Error,
	) {
		super(
			`${message}: ${path}${originalError ? ` (${originalError.message})` : ""}`,
		);
	}
}
