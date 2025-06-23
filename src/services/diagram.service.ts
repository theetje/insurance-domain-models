import { DomainModel, SiviEntity, DiagramConfig } from '../types';
import { Logger } from '../utils/logger';

/**
 * Service for generating UML diagrams in Mermaid and PlantUML formats
 */
export class DiagramService {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Generate diagram based on configuration
   */
  generateDiagram(model: DomainModel, config: DiagramConfig): string {
    this.logger.info(`Generating ${config.format} diagram for model: ${model.name}`);

    switch (config.format) {
      case 'mermaid':
        return this.generateMermaidDiagram(model, config);
      case 'plantuml':
        return this.generatePlantUMLDiagram(model, config);
      default:
        throw new Error(`Unsupported diagram format: ${config.format}`);
    }
  }

  /**
   * Generate Mermaid class diagram
   */
  private generateMermaidDiagram(model: DomainModel, config: DiagramConfig): string {
    const lines: string[] = [];
    
    // Diagram header
    lines.push('classDiagram');
    
    if (config.direction && config.direction !== 'TB') {
      lines.push(`    direction ${config.direction}`);
    }
    
    lines.push('');
    
    // Add metadata comment if enabled
    if (config.includeMetadata) {
      lines.push(`    %% Domain Model: ${model.name}`);
      lines.push(`    %% Version: ${model.version}`);
      lines.push(`    %% Generated: ${new Date().toISOString()}`);
      lines.push(`    %% Based on SIVI AFD ${model.metadata.siviVersion}`);
      lines.push('');
    }

    // Generate classes
    model.entities.forEach(entity => {
      lines.push(`    class ${entity.name} {`);
      
      if (config.showAttributes) {
        entity.attributes.forEach(attr => {
          const required = attr.required ? '+' : '-';
          const description = attr.description ? ` // ${attr.description}` : '';
          lines.push(`        ${required}${attr.name}: ${attr.type}${description}`);
        });
      }
      
      if (config.showMethods) {
        // Add some common methods based on entity type
        const methods = this.getCommonMethods(entity.type);
        methods.forEach(method => {
          lines.push(`        +${method}()`);
        });
      }
      
      lines.push('    }');
      lines.push('');
    });

    // Generate relationships if enabled
    if (config.showRelationships) {
      model.entities.forEach(entity => {
        entity.relationships.forEach(rel => {
          const relationship = this.formatMermaidRelationship(rel);
          const label = rel.description ? ` : ${rel.description}` : '';
          lines.push(`    ${entity.name} ${relationship} ${rel.target}${label}`);
        });
      });
    }

    // Add styling
    lines.push('');
    lines.push('    %% Styling for SIVI AFD entities');
    lines.push('    classDef policyClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px');
    lines.push('    classDef coverageClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px');
    lines.push('    classDef partyClass fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px');
    lines.push('    classDef claimClass fill:#fff3e0,stroke:#e65100,stroke-width:2px');
    lines.push('');
    
    // Apply styling
    model.entities.forEach(entity => {
      const styleClass = this.getMermaidStyleClass(entity.type);
      if (styleClass) {
        lines.push(`    class ${entity.name} ${styleClass}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Generate PlantUML class diagram
   */
  private generatePlantUMLDiagram(model: DomainModel, config: DiagramConfig): string {
    const lines: string[] = [];
    
    // Diagram header
    lines.push('@startuml');
    lines.push('!theme plain');
    lines.push('');
    
    // Add metadata
    if (config.includeMetadata) {
      lines.push(`title ${model.name} - Domain Model`);
      lines.push(`note top : Version ${model.version}\\nBased on SIVI AFD ${model.metadata.siviVersion}\\nGenerated: ${new Date().toISOString()}`);
      lines.push('');
    }

    // Set direction
    if (config.direction) {
      const plantUMLDirection = this.convertToPlantUMLDirection(config.direction);
      lines.push(`!define DIRECTION ${plantUMLDirection}`);
      lines.push('');
    }

    // Generate classes
    model.entities.forEach(entity => {
      const stereotype = this.getPlantUMLStereotype(entity.type);
      lines.push(`class ${entity.name} ${stereotype} {`);
      
      if (config.showAttributes) {
        entity.attributes.forEach(attr => {
          const visibility = attr.required ? '+' : '-';
          const description = attr.description ? ` {${attr.description}}` : '';
          lines.push(`  ${visibility} ${attr.name}: ${attr.type}${description}`);
        });
      }
      
      if (config.showMethods) {
        lines.push('  --');
        const methods = this.getCommonMethods(entity.type);
        methods.forEach(method => {
          lines.push(`  + ${method}()`);
        });
      }
      
      lines.push('}');
      lines.push('');
    });

    // Generate relationships
    if (config.showRelationships) {
      model.entities.forEach(entity => {
        entity.relationships.forEach(rel => {
          const relationship = this.formatPlantUMLRelationship(rel);
          const label = rel.description ? ` : ${rel.description}` : '';
          lines.push(`${entity.name} ${relationship} ${rel.target}${label}`);
        });
      });
    }

    // Add colors
    lines.push('');
    lines.push('skinparam class {');
    lines.push('  BackgroundColor<<Policy>> #e1f5fe');
    lines.push('  BorderColor<<Policy>> #01579b');
    lines.push('  BackgroundColor<<Coverage>> #f3e5f5');
    lines.push('  BorderColor<<Coverage>> #4a148c');
    lines.push('  BackgroundColor<<Party>> #e8f5e8');
    lines.push('  BorderColor<<Party>> #1b5e20');
    lines.push('  BackgroundColor<<Claim>> #fff3e0');
    lines.push('  BorderColor<<Claim>> #e65100');
    lines.push('}');
    
    lines.push('@enduml');
    
    return lines.join('\n');
  }

  /**
   * Format Mermaid relationship syntax
   */
  private formatMermaidRelationship(rel: SiviEntity['relationships'][0]): string {
    const cardinalityMap: Record<string, string> = {
      '1': '"1"',
      '0..1': '"0..1"',
      '1..*': '"1..*"',
      '*': '"*"',
      '0..*': '"0..*"'
    };

    const cardinality = cardinalityMap[rel.cardinality] || `"${rel.cardinality}"`;

    switch (rel.type) {
      case 'association':
        return `${cardinality} --> "*"`;
      case 'aggregation':
        return `${cardinality} --o "*"`;
      case 'composition':
        return `${cardinality} --* "*"`;
      case 'inheritance':
        return '<|--';
      default:
        return `${cardinality} --> "*"`;
    }
  }

  /**
   * Format PlantUML relationship syntax
   */
  private formatPlantUMLRelationship(rel: SiviEntity['relationships'][0]): string {
    const cardinality = rel.cardinality;

    switch (rel.type) {
      case 'association':
        return `"${cardinality}" --> "*"`;
      case 'aggregation':
        return `"${cardinality}" o-- "*"`;
      case 'composition':
        return `"${cardinality}" *-- "*"`;
      case 'inheritance':
        return '<|--';
      default:
        return `"${cardinality}" --> "*"`;
    }
  }

  /**
   * Get common methods for entity types
   */
  private getCommonMethods(entityType: string): string[] {
    const commonMethods: Record<string, string[]> = {
      Policy: ['validate()', 'calculatePremium()', 'renew()', 'cancel()'],
      Coverage: ['calculatePremium()', 'checkEligibility()', 'applyDeductible()'],
      Party: ['updateContact()', 'validateInfo()', 'getRole()'],
      Claim: ['process()', 'approve()', 'reject()', 'calculatePayout()'],
      Premium: ['calculate()', 'applyDiscount()', 'processPayment()'],
      Object: ['appraise()', 'inspect()', 'updateValue()'],
      Clause: ['apply()', 'validate()', 'interpret()']
    };

    return commonMethods[entityType] || ['getId()', 'toString()'];
  }

  /**
   * Get Mermaid style class for entity type
   */
  private getMermaidStyleClass(entityType: string): string {
    const styleMap: Record<string, string> = {
      Policy: 'policyClass',
      Coverage: 'coverageClass',
      Party: 'partyClass',
      Claim: 'claimClass'
    };

    return styleMap[entityType] || '';
  }

  /**
   * Get PlantUML stereotype for entity type
   */
  private getPlantUMLStereotype(entityType: string): string {
    const stereotypeMap: Record<string, string> = {
      Policy: '<<Policy>>',
      Coverage: '<<Coverage>>',
      Party: '<<Party>>',
      Claim: '<<Claim>>',
      Premium: '<<Premium>>',
      Object: '<<Object>>',
      Clause: '<<Clause>>'
    };

    return stereotypeMap[entityType] || '';
  }

  /**
   * Convert Mermaid direction to PlantUML direction
   */
  private convertToPlantUMLDirection(direction: string): string {
    const directionMap: Record<string, string> = {
      'TB': 'top to bottom direction',
      'TD': 'top to bottom direction',
      'BT': 'bottom to top direction',
      'LR': 'left to right direction',
      'RL': 'right to left direction'
    };

    return directionMap[direction] || 'top to bottom direction';
  }

  /**
   * Generate sequence diagram for insurance process flows
   */
  generateSequenceDiagram(processName: string, format: 'mermaid' | 'plantuml' = 'mermaid'): string {
    const processes: Record<string, any> = {
      'policy-creation': {
        title: 'Policy Creation Process',
        participants: ['Customer', 'Broker', 'Underwriter', 'PolicySystem'],
        steps: [
          { from: 'Customer', to: 'Broker', message: 'Request Quote' },
          { from: 'Broker', to: 'Underwriter', message: 'Submit Application' },
          { from: 'Underwriter', to: 'PolicySystem', message: 'Create Policy' },
          { from: 'PolicySystem', to: 'Underwriter', message: 'Policy Created' },
          { from: 'Underwriter', to: 'Broker', message: 'Policy Approved' },
          { from: 'Broker', to: 'Customer', message: 'Policy Documents' }
        ]
      },
      'claim-processing': {
        title: 'Claim Processing Flow',
        participants: ['Insured', 'ClaimAgent', 'Adjuster', 'ClaimSystem'],
        steps: [
          { from: 'Insured', to: 'ClaimAgent', message: 'Report Claim' },
          { from: 'ClaimAgent', to: 'ClaimSystem', message: 'Create Claim Record' },
          { from: 'ClaimAgent', to: 'Adjuster', message: 'Assign for Investigation' },
          { from: 'Adjuster', to: 'ClaimSystem', message: 'Update Claim Status' },
          { from: 'ClaimSystem', to: 'Insured', message: 'Claim Settlement' }
        ]
      }
    };

    const process = processes[processName];
    if (!process) {
      throw new Error(`Unknown process: ${processName}`);
    }

    if (format === 'mermaid') {
      return this.generateMermaidSequence(process);
    } else {
      return this.generatePlantUMLSequence(process);
    }
  }

  private generateMermaidSequence(process: any): string {
    const lines: string[] = [];
    
    lines.push('sequenceDiagram');
    lines.push(`    title ${process.title}`);
    lines.push('');
    
    // Add participants
    process.participants.forEach((participant: string) => {
      lines.push(`    participant ${participant}`);
    });
    
    lines.push('');
    
    // Add steps
    process.steps.forEach((step: any, index: number) => {
      lines.push(`    ${step.from}->>+${step.to}: ${step.message}`);
      if (index < process.steps.length - 1) {
        lines.push(`    ${step.to}-->>-${step.from}: Acknowledged`);
      }
    });
    
    return lines.join('\n');
  }

  private generatePlantUMLSequence(process: any): string {
    const lines: string[] = [];
    
    lines.push('@startuml');
    lines.push(`title ${process.title}`);
    lines.push('');
    
    // Add participants
    process.participants.forEach((participant: string) => {
      lines.push(`participant ${participant}`);
    });
    
    lines.push('');
    
    // Add steps
    process.steps.forEach((step: any) => {
      lines.push(`${step.from} -> ${step.to}: ${step.message}`);
    });
    
    lines.push('@enduml');
    
    return lines.join('\n');
  }
}
