import { SiviEntity, DomainModel, SiviValidationError } from '../types';
import { Logger } from '../utils/logger';

/**
 * SIVI AFD 2.0 Service for managing insurance domain entities
 * Based on the Dutch insurance industry standard
 */
export class SiviService {
  private logger: Logger;
  private baseUrl: string;
  private version: string;

  // Core SIVI AFD 2.0 entities based on the standard
  private static readonly CORE_ENTITIES = {
    Policy: {
      id: 'policy',
      name: 'Policy',
      description: 'Insurance policy/contract entity',
      type: 'Policy' as const,
      attributes: [
        { name: 'contractNumber', type: 'string', required: true, description: 'Unique policy contract number', siviReference: 'AFD.Policy.ContractNumber' },
        { name: 'effectiveDate', type: 'Date', required: true, description: 'Policy effective date', siviReference: 'AFD.Policy.EffectiveDate' },
        { name: 'expirationDate', type: 'Date', required: true, description: 'Policy expiration date', siviReference: 'AFD.Policy.ExpirationDate' },
        { name: 'status', type: 'string', required: true, description: 'Policy status', siviReference: 'AFD.Policy.Status' },
        { name: 'policyType', type: 'string', required: true, description: 'Type of insurance policy', siviReference: 'AFD.Policy.Type' },
        { name: 'premium', type: 'number', required: false, description: 'Policy premium amount', siviReference: 'AFD.Policy.Premium' }
      ],
      relationships: [
        { type: 'aggregation' as const, target: 'coverage', cardinality: '1..*', description: 'Policy includes one or more coverages' },
        { type: 'association' as const, target: 'party', cardinality: '1..*', description: 'Policy involves multiple parties' },
        { type: 'association' as const, target: 'premium', cardinality: '1', description: 'Policy has premium information' }
      ],
      siviReference: 'AFD.Policy',
      version: '2.0'
    },
    Coverage: {
      id: 'coverage',
      name: 'Coverage',
      description: 'Insurance coverage details',
      type: 'Coverage' as const,
      attributes: [
        { name: 'coverageCode', type: 'string', required: true, description: 'Coverage type code', siviReference: 'AFD.Coverage.Code' },
        { name: 'description', type: 'string', required: true, description: 'Coverage description', siviReference: 'AFD.Coverage.Description' },
        { name: 'limit', type: 'number', required: false, description: 'Coverage limit amount', siviReference: 'AFD.Coverage.Limit' },
        { name: 'deductible', type: 'number', required: false, description: 'Coverage deductible amount', siviReference: 'AFD.Coverage.Deductible' },
        { name: 'premium', type: 'number', required: false, description: 'Coverage premium', siviReference: 'AFD.Coverage.Premium' }
      ],
      relationships: [
        { type: 'association' as const, target: 'object', cardinality: '0..*', description: 'Coverage may apply to insured objects' },
        { type: 'association' as const, target: 'clause', cardinality: '0..*', description: 'Coverage may have specific clauses' }
      ],
      siviReference: 'AFD.Coverage',
      version: '2.0'
    },
    Party: {
      id: 'party',
      name: 'Party',
      description: 'Parties involved in insurance policy',
      type: 'Party' as const,
      attributes: [
        { name: 'partyId', type: 'string', required: true, description: 'Unique party identifier', siviReference: 'AFD.Party.Id' },
        { name: 'role', type: 'string', required: true, description: 'Party role (Insured, Insurer, Broker, etc.)', siviReference: 'AFD.Party.Role' },
        { name: 'name', type: 'string', required: true, description: 'Party name', siviReference: 'AFD.Party.Name' },
        { name: 'address', type: 'string', required: false, description: 'Party address', siviReference: 'AFD.Party.Address' },
        { name: 'contactInfo', type: 'string', required: false, description: 'Party contact information', siviReference: 'AFD.Party.Contact' }
      ],
      relationships: [],
      siviReference: 'AFD.Party',
      version: '2.0'
    },
    Claim: {
      id: 'claim',
      name: 'Claim',
      description: 'Insurance claim entity',
      type: 'Claim' as const,
      attributes: [
        { name: 'claimNumber', type: 'string', required: true, description: 'Unique claim number', siviReference: 'AFD.Claim.Number' },
        { name: 'claimDate', type: 'Date', required: true, description: 'Claim occurrence date', siviReference: 'AFD.Claim.Date' },
        { name: 'reportDate', type: 'Date', required: true, description: 'Claim report date', siviReference: 'AFD.Claim.ReportDate' },
        { name: 'status', type: 'string', required: true, description: 'Claim status', siviReference: 'AFD.Claim.Status' },
        { name: 'amount', type: 'number', required: false, description: 'Claim amount', siviReference: 'AFD.Claim.Amount' },
        { name: 'description', type: 'string', required: false, description: 'Claim description', siviReference: 'AFD.Claim.Description' }
      ],
      relationships: [
        { type: 'association' as const, target: 'policy', cardinality: '1', description: 'Claim is associated with a policy' },
        { type: 'association' as const, target: 'coverage', cardinality: '1..*', description: 'Claim affects one or more coverages' }
      ],
      siviReference: 'AFD.Claim',
      version: '2.0'
    },
    Premium: {
      id: 'premium',
      name: 'Premium',
      description: 'Insurance premium information',
      type: 'Premium' as const,
      attributes: [
        { name: 'amount', type: 'number', required: true, description: 'Premium amount', siviReference: 'AFD.Premium.Amount' },
        { name: 'currency', type: 'string', required: true, description: 'Premium currency', siviReference: 'AFD.Premium.Currency' },
        { name: 'paymentFrequency', type: 'string', required: true, description: 'Payment frequency', siviReference: 'AFD.Premium.Frequency' },
        { name: 'dueDate', type: 'Date', required: false, description: 'Premium due date', siviReference: 'AFD.Premium.DueDate' }
      ],
      relationships: [],
      siviReference: 'AFD.Premium',
      version: '2.0'
    },
    Object: {
      id: 'object',
      name: 'Object',
      description: 'Insured object/item',
      type: 'Object' as const,
      attributes: [
        { name: 'objectId', type: 'string', required: true, description: 'Unique object identifier', siviReference: 'AFD.Object.Id' },
        { name: 'type', type: 'string', required: true, description: 'Object type', siviReference: 'AFD.Object.Type' },
        { name: 'description', type: 'string', required: false, description: 'Object description', siviReference: 'AFD.Object.Description' },
        { name: 'value', type: 'number', required: false, description: 'Object value', siviReference: 'AFD.Object.Value' },
        { name: 'location', type: 'string', required: false, description: 'Object location', siviReference: 'AFD.Object.Location' }
      ],
      relationships: [],
      siviReference: 'AFD.Object',
      version: '2.0'
    },
    Clause: {
      id: 'clause',
      name: 'Clause',
      description: 'Policy clause or condition',
      type: 'Clause' as const,
      attributes: [
        { name: 'clauseId', type: 'string', required: true, description: 'Unique clause identifier', siviReference: 'AFD.Clause.Id' },
        { name: 'type', type: 'string', required: true, description: 'Clause type', siviReference: 'AFD.Clause.Type' },
        { name: 'description', type: 'string', required: true, description: 'Clause description', siviReference: 'AFD.Clause.Description' },
        { name: 'text', type: 'string', required: false, description: 'Full clause text', siviReference: 'AFD.Clause.Text' }
      ],
      relationships: [],
      siviReference: 'AFD.Clause',
      version: '2.0'
    }
  };

  constructor(baseUrl: string = 'https://www.sivi.org/afd', version: string = '2.0') {
    this.logger = Logger.getInstance();
    this.baseUrl = baseUrl;
    this.version = version;
  }

  /**
   * Get all core SIVI AFD 2.0 entities
   */
  getCoreEntities(): SiviEntity[] {
    return Object.values(SiviService.CORE_ENTITIES);
  }

  /**
   * Get a specific entity by ID
   */
  getEntity(entityId: string): SiviEntity | null {
    const entity = Object.values(SiviService.CORE_ENTITIES).find(e => e.id === entityId);
    return entity || null;
  }

  /**
   * Create a new domain model with SIVI AFD 2.0 foundation
   */
  createDomainModel(name: string, description?: string): DomainModel {
    const now = new Date().toISOString();
    
    return {
      name,
      version: '1.0.0',
      description,
      namespace: 'nl.sivi.afd.insurance',
      entities: this.getCoreEntities(),
      metadata: {
        created: now,
        updated: now,
        author: 'SIVI AFD 2.0 Model Creator',
        siviVersion: this.version
      }
    };
  }

  /**
   * Validate entity against SIVI AFD 2.0 standards
   */
  validateEntity(entity: SiviEntity): void {
    const errors: string[] = [];

    // Check required fields
    if (!entity.id || !entity.name || !entity.type) {
      errors.push('Entity must have id, name, and type');
    }

    // Validate entity type
    const validTypes = ['Policy', 'Coverage', 'Party', 'Claim', 'Premium', 'Object', 'Clause'];
    if (!validTypes.includes(entity.type)) {
      errors.push(`Invalid entity type: ${entity.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate attributes
    entity.attributes.forEach((attr, index) => {
      if (!attr.name || !attr.type) {
        errors.push(`Attribute at index ${index} must have name and type`);
      }
    });

    // Validate relationships
    entity.relationships.forEach((rel, index) => {
      if (!rel.type || !rel.target || !rel.cardinality) {
        errors.push(`Relationship at index ${index} must have type, target, and cardinality`);
      }
      
      const validRelTypes = ['association', 'aggregation', 'composition', 'inheritance'];
      if (!validRelTypes.includes(rel.type)) {
        errors.push(`Invalid relationship type: ${rel.type}. Must be one of: ${validRelTypes.join(', ')}`);
      }
    });

    if (errors.length > 0) {
      throw new SiviValidationError(`Entity validation failed: ${errors.join(', ')}`, { entity, errors });
    }
  }

  /**
   * Validate entire domain model
   */
  validateDomainModel(model: DomainModel): void {
    const errors: string[] = [];

    // Basic model validation
    if (!model.name || !model.version) {
      errors.push('Domain model must have name and version');
    }

    // Validate all entities
    model.entities.forEach((entity, index) => {
      try {
        this.validateEntity(entity);
      } catch (error) {
        if (error instanceof SiviValidationError) {
          errors.push(`Entity ${index} (${entity.name}): ${error.message}`);
        }
      }
    });

    // Check for entity ID uniqueness
    const entityIds = model.entities.map(e => e.id);
    const duplicateIds = entityIds.filter((id, index) => entityIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate entity IDs found: ${duplicateIds.join(', ')}`);
    }

    // Validate relationship targets exist
    model.entities.forEach(entity => {
      entity.relationships.forEach(rel => {
        if (!entityIds.includes(rel.target)) {
          errors.push(`Entity ${entity.name} has relationship to non-existent entity: ${rel.target}`);
        }
      });
    });

    if (errors.length > 0) {
      throw new SiviValidationError(`Domain model validation failed: ${errors.join('; ')}`, { model, errors });
    }

    this.logger.info(`Domain model '${model.name}' validated successfully`);
  }

  /**
   * Extend domain model with custom entities
   */
  extendDomainModel(model: DomainModel, customEntities: SiviEntity[]): DomainModel {
    // Validate custom entities
    customEntities.forEach(entity => this.validateEntity(entity));

    // Check for ID conflicts
    const existingIds = model.entities.map(e => e.id);
    const newIds = customEntities.map(e => e.id);
    const conflicts = newIds.filter(id => existingIds.includes(id));
    
    if (conflicts.length > 0) {
      throw new SiviValidationError(`Entity ID conflicts: ${conflicts.join(', ')}`);
    }

    const extendedModel: DomainModel = {
      ...model,
      entities: [...model.entities, ...customEntities],
      metadata: {
        ...model.metadata,
        updated: new Date().toISOString()
      }
    };

    // Validate the extended model
    this.validateDomainModel(extendedModel);

    return extendedModel;
  }

  /**
   * Get entity relationships for a specific entity
   */
  getEntityRelationships(model: DomainModel, entityId: string): Array<{
    entity: SiviEntity;
    relationship: SiviEntity['relationships'][0];
    target: SiviEntity;
  }> {
    const entity = model.entities.find(e => e.id === entityId);
    if (!entity) {
      throw new Error(`Entity with ID '${entityId}' not found`);
    }

    return entity.relationships.map(rel => {
      const target = model.entities.find(e => e.id === rel.target);
      if (!target) {
        throw new Error(`Target entity '${rel.target}' not found`);
      }
      
      return {
        entity,
        relationship: rel,
        target
      };
    });
  }
}
