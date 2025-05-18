import { errorStatus, normalize, skippedStatus, successStatus } from "../utils"
import type { YoutrackService } from "./youtrack.service"
import { writeTypeFile } from "../tools/fs.tools"
import type { ActionResult } from "../types"

type FieldData = {
  name: string
  comment: string
  isMultiValue: boolean
  canBeEmpty: boolean
  isBundle: boolean
  type: string
  bundleName?: string
}

const typeMapping: Record<string, string> = {
  enum: "EnumField",
  state: "State",
  build: "ProjectBuild",
  version: "ProjectVersion",
  period: "Period",
  date: "number",
  integer: "number",
  float: "number",
  text: "string",
  string: "string",
  user: "User",
  ownedfield: "OwnedField",
}

export class TypeScriptService {
  constructor(private readonly youtrack: YoutrackService) {}

  public async generateTypeDefinitions(projectId: string): Promise<ActionResult> {
    try {
      // Get project info
      const projects = await this.youtrack.fetchProjects()
      const project = projects.find((p) => p.id === projectId || p.shortName === projectId)

      if (!project) {
        return skippedStatus(`Project ${projectId} not found`)
      }

      // Get custom fields for the project
      const customFields = await this.youtrack.getProjectCustomFields(project.id)

      // Get work item types directly from the API
      const workItemTypes = await this.youtrack.getProjectWorkflowItems(project.id)

      // Parse fields data
      const fieldsData: FieldData[] = []
      const bundleTypes: Record<string, string[]> = {}

      for (const field of customFields) {
        const fieldData: FieldData = {
          name: field.name,
          comment: `${field.type} (${field.isMultiValue ? "multi" : "single"})`,
          isMultiValue: field.isMultiValue,
          canBeEmpty: field.canBeEmpty,
          isBundle: field.isBundleType,
          type: typeMapping[field.type.toLowerCase()] || field.type,
          bundleName: "",
        }

        // If it's a bundle field (except user fields), store the values for type generation
        if (field.isBundleType && field.values && field.values.length > 0 && field.type.toLowerCase() !== "user") {
          fieldData.bundleName = `${normalize(field.name, true, "CustomField")}Value`
          bundleTypes[fieldData.bundleName] = [...field.values]
        }

        fieldsData.push(fieldData)
      }

      // Generate the type definition content
      const typeDefs = this.generateTypeDefinitionContent(fieldsData, workItemTypes, bundleTypes)

      // Write the type definition file
      await writeTypeFile(project.shortName, typeDefs)

      return successStatus("Generated")
    } catch (error) {
      return errorStatus(error instanceof Error ? error.message : String(error))
    }
  }

  private printBundleTypeValues(bundleTypes: Record<string, string[]>): string {
    const types: string[] = []

    for (const [typeName, values] of Object.entries(bundleTypes)) {
      if (values?.length) {
        types.push(`\ntype ${typeName} =\n${values.map((v) => `  | "${v}"`).join("\n")}`)
      }
    }

    return types.join("\n")
  }

  private printFieldsInterface(fields: FieldData[]): string {
    const fieldLines: string[] = []

    for (const field of fields) {
      const fieldName = field.name
      const isSpecialName = fieldName.includes(" ") || /^\d/.test(fieldName)
      const fieldNameFormatted = isSpecialName ? `"${fieldName}"` : fieldName

      let fieldType = field.type
      const comment = field.comment

      if (field.isBundle && field.bundleName) {
        fieldType = `${field.type}<${field.bundleName}>`
      }

      // Handle multi-value fields
      if (field.isMultiValue) {
        fieldType = `YTSet<${fieldType}>`
      } else if (field.canBeEmpty) {
        // Handle nullable fields
        fieldType += " | null"
      }

      // For multi-value fields or getters/setters
      if (field.isBundle && !field.isMultiValue && field.type !== "User") {
        // Add getter and setter with comment before them
        fieldLines.push(`  // ${comment}`)
        fieldLines.push(`  get ${fieldNameFormatted}(): ${fieldType};`)

        // Add setter with appropriate value type
        let setterType: string
        if (field.type.toLowerCase() === "period") {
          setterType = `string | ${fieldType}`
        } else if (field.isBundle) {
          setterType = field.bundleName || "string"
        } else {
          setterType = fieldType
        }
        fieldLines.push(`  set ${fieldNameFormatted}(value: ${setterType});`)
      } else {
        // Format regular fields
        fieldLines.push(`  // ${comment}`)
        fieldLines.push(`  ${fieldNameFormatted}: ${fieldType};`)
      }
    }

    return `interface Fields {\n${fieldLines.join("\n")}\n}`
  }

  private generateTypeDefinitionContent(
    fields: FieldData[],
    workItemTypes: string[],
    bundleTypes: Record<string, string[]>,
  ): string {
    // Generate imports section
    const imports = ["entities", "date-time"]
      .map((p) => `import ${normalize(p)} from '@jetbrains/youtrack-scripting-api/${p}'`)
      .join("\n")

    // Generate custom bundle types
    const bundleTypesStr = this.printBundleTypeValues(bundleTypes)

    // Generate work item type
    let workItemType = ""
    if (workItemTypes.length > 0) {
      const uniqueTypes = [...new Set(workItemTypes)]
      workItemType = `\ntype WorkItemTypeValue =\n${uniqueTypes.map((v) => `  | "${v}"`).join("\n")}`
    } else {
      // Default work item type if none found
      workItemType = "\ntype WorkItemTypeValue = string;"
    }

    // Generate Fields interface
    const fieldsInterface = this.printFieldsInterface(fields)

    // Generate the Issue and IssueWorkItem types
    const issueTypes =
      "\ntype Issue = YTIssue<Fields, WorkItemTypeValue>;\ntype IssueWorkItem = YTIssueWorkItem<WorkItemTypeValue>;"

    // Type aliases for YouTrack entity types to make usage cleaner
    const typeAliases = [
      "type YTIssue<F, W> = entities.Issue<F, W>;",
      "type YTIssueWorkItem<W> = entities.IssueWorkItem<W>;",
      "type YTSet<T> = entities.Set<T>;",
      "type User = entities.User;",
      "type OwnedField = entities.OwnedField;",
      "type EnumField<T> = entities.EnumField<T>;",
      "type State<T> = entities.State<T>;",
      "type ProjectVersion = entities.ProjectVersion;",
      "type ProjectBuild = entities.ProjectBuild;",
      "type Period = dateTime.Period;",
    ].join("\n")

    // Compile the full type definition content
    return `${imports}\n\n${typeAliases}\n${bundleTypesStr}\n${workItemType}\n\n${fieldsInterface}\n${issueTypes}\n`
  }
}
