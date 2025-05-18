import type { YoutrackService } from "./youtrack.service";
import { writeTypeFile } from "../tools/fs.tools";
import { normalize } from "../utils";

type FieldData = {
  name: string
  comment: string
  isMultiValue: boolean
  canBeEmpty: boolean
  isBundle: boolean
  type: string
  values?: string[]
}

export class TypeScriptService {

  constructor(private readonly youtrack: YoutrackService) {}

  public async generateTypeDefinitions(projectId: string): Promise<boolean> {
    try {
      // Get project info
      const projects = await this.youtrack.fetchProjects();
      const project = projects.find(p => p.id === projectId || p.shortName === projectId);
      
      if (!project) {
        console.error(`Project with ID/shortName '${projectId}' not found`)
        return false;
      }

      // Get custom fields for the project
      const customFields = await this.youtrack.getProjectCustomFields(project.id);
      
      // Get work item types directly from the API
      const workItemTypes = await this.youtrack.getProjectWorkflowItems(project.id);
      
      // Parse fields data
      const fieldsData: FieldData[] = [];
      const bundleTypes: Record<string, string[]> = {};
      
      for (const field of customFields) {
        const fieldData: FieldData = {
          name: field.name,
          comment: `${field.type} (${field.isMultiValue ? 'multi' : 'single'})`,
          isMultiValue: field.isMultiValue,
          canBeEmpty: field.canBeEmpty,
          isBundle: field.isBundleType,
          type: field.type,
          values: field.values
        };
        
        // If it's a bundle field (except user fields), store the values for type generation
        if (field.isBundleType && field.values && field.values.length > 0 && field.type.toLowerCase() !== 'user') {
          const typeName = `${normalize(field.name, true, '')}Value`;
          bundleTypes[typeName] = [...field.values];
        }
        
        fieldsData.push(fieldData);
      }
      
      // Generate the type definition content
      const typeDefs = this.generateTypeDefinitionContent(fieldsData, workItemTypes, bundleTypes);
      
      // Write the type definition file
      await writeTypeFile(project.shortName, typeDefs);
      
      console.log(`Type definitions for project '${project.name}' (${project.shortName}) generated`);
      return true;
    } catch (error) {
      console.error(`Error generating type definitions for project ${projectId}:`, error);
      return false;
    }
  }

  private printBundleTypeValues(bundleTypes: Record<string, string[]>): string {
    const types: string[] = [];
    
    for (const [typeName, values] of Object.entries(bundleTypes)) {
      if (values?.length) {
        types.push(`\ntype ${typeName} =\n${values.map((v) => `  | "${v}"`).join("\n")}`);
      }
    }
    
    return types.join("\n");
  }

  private printFieldsInterface(fields: FieldData[]): string {
    const fieldLines: string[] = [];

    for (const field of fields) {
      const fieldName = field.name;
      const isSpecialName = fieldName.includes(' ') || /^\d/.test(fieldName);
      const fieldNameFormatted = isSpecialName ? `["${fieldName}"]` : fieldName;

      let fieldType = '';
      const comment = field.comment;
      
      switch(field.type.toLowerCase()) {
        case 'enum': {
          const enumTypeName = `${normalize(field.name, true, '')}Value`;
          fieldType = `EnumField<${enumTypeName}>`;
          break;
        }
        case 'state':
          fieldType = "State<StateValue>";
          break;
        case 'build':
          fieldType = "ProjectBuild";
          break;
        case 'version':
          fieldType = "ProjectVersion";
          break;
        case 'period':
          fieldType = "Period";
          break;
        case 'date':
          fieldType = 'number'; // YouTrack uses timestamps for dates
          break;
        case 'integer':
        case 'float':
          fieldType = 'number';
          break;
        case 'text':
        case 'string':
          fieldType = 'string';
          break;
        case 'user':
          fieldType = 'User';
          break;
        case 'ownedfield':
          fieldType = 'OwnedField';
          break;
        default:
          fieldType = field.type;
      }

      // Handle multi-value fields
      if (field.isMultiValue) {
        fieldType = `YTSet<${fieldType}>`;
      } else if (field.canBeEmpty) {
        // Handle nullable fields
        fieldType += ' | null';
      }

      // For multi-value fields or getters/setters
      if (field.isMultiValue || field.type.toLowerCase() === 'enum' || field.type.toLowerCase() === 'state' || field.type.toLowerCase() === 'period' || field.type.toLowerCase() === 'version') {
        if (field.isMultiValue) {
          fieldLines.push(`  // ${comment}`);
          fieldLines.push(`  ${fieldNameFormatted}: ${fieldType};`);
        } else {
          // Add getter and setter with comment before them
          fieldLines.push(`  // ${comment}`);
          fieldLines.push(`  get ${fieldNameFormatted}(): ${fieldType};`);
          
          // Add setter with appropriate value type
          let setterType: string;
          if (field.type.toLowerCase() === 'period') {
            setterType = `string | ${fieldType}`;
          } else if (field.isBundle) {
            const typeName = `${normalize(field.name, true, '')}Value`;
            setterType = typeName;
          } else {
            setterType = fieldType;
          }
          fieldLines.push(`  set ${fieldNameFormatted}(value: ${setterType.replace(/EnumField<|State<|>/g, '')});`);
        }
      } else {
        // Format regular fields
        fieldLines.push(`  // ${comment}`);
        fieldLines.push(`  ${fieldNameFormatted}${field.isMultiValue ? '' : `: ${fieldType}`};`);
      }
    }

    return `interface Fields {\n${fieldLines.join('\n')}\n}`;
  }

  private generateTypeDefinitionContent(fields: FieldData[], workItemTypes: string[], bundleTypes: Record<string, string[]>): string {
    // Generate imports section
    const imports = ["entities", "date-time"].map(p => `import ${normalize(p)} from '@jetbrains/youtrack-scripting-api/${p}'`).join("\n");
    
    // Generate custom bundle types
    const bundleTypesStr = this.printBundleTypeValues(bundleTypes);
    
    // Generate work item type
    let workItemType = '';
    if (workItemTypes.length > 0) {
      const uniqueTypes = [...new Set(workItemTypes)];
      workItemType = `\ntype WorkItemTypeValue =\n${uniqueTypes.map((v) => `  | "${v}"`).join("\n")}`;
    } else {
      // Default work item type if none found
      workItemType = '\ntype WorkItemTypeValue = string;';
    }
    
    // Generate Fields interface
    const fieldsInterface = this.printFieldsInterface(fields);
    
    // Generate the Issue and IssueWorkItem types
    const issueTypes = "\ntype Issue = YTIssue<Fields, WorkItemTypeValue>;\ntype IssueWorkItem = YTIssueWorkItem<WorkItemTypeValue>;";
    
    // Type aliases for YouTrack entity types to make usage cleaner
    const typeAliases = [
      'type YTIssue<F, W> = entities.Issue<F, W>;',
      'type YTIssueWorkItem<W> = entities.IssueWorkItem<W>;',
      'type YTSet<T> = entities.Set<T>;',
      'type User = entities.User;',
      'type OwnedField = entities.OwnedField;',
      'type EnumField<T> = entities.EnumField<T>;',
      'type State<T> = entities.State<T>;',
      'type ProjectVersion = entities.ProjectVersion;',
      'type ProjectBuild = entities.ProjectBuild;',
      'type Period = dateTime.Period;'
    ].join('\n');
    
    // Compile the full type definition content
    return `${imports}\n\n${typeAliases}\n${bundleTypesStr}\n${workItemType}\n\n${fieldsInterface}\n${issueTypes}\n`;
  }
}
