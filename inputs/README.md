# Model Inputs

This directory contains JSON model input files for the SIVI AFD 2.0 Model Creator.

## SIVI AFD 2.0 JSON Model Format

The JSON model format is specifically designed to create domain models that comply with the **SIVI All Finance Data (AFD) 2.0** standard - the Dutch insurance industry standard for data exchange and modeling. This format ensures that all generated models follow the standardized structure, naming conventions, and relationships defined by the Dutch insurance industry.

### Model Structure Overview

Each JSON file represents a complete insurance domain model with standardized entities, attributes, and relationships that align with SIVI AFD 2.0 specifications. The model creator automatically validates each model against SIVI standards to ensure compliance and consistency.

### Root Model Properties

```json
{
  "name": "Insurance Domain Model Name",
  "version": "1.0.0",
  "description": "Detailed description of the insurance domain",
  "namespace": "nl.sivi.afd.insurance",
  "entities": [...]
}
```

- **name**: Descriptive name for the insurance domain model
- **version**: Semantic version following standard versioning practices
- **description**: Comprehensive description of the insurance domain being modeled
- **namespace**: Must follow the SIVI namespace convention `nl.sivi.afd.*`
- **entities**: Array of SIVI AFD 2.0 compliant entities

### SIVI AFD 2.0 Entity Structure

Each entity in the model must conform to SIVI AFD 2.0 standards:

```json
{
  "id": "unique-entity-identifier",
  "name": "Entity Display Name",
  "description": "Detailed entity description",
  "type": "SIVI_ENTITY_TYPE",
  "attributes": [...],
  "relationships": [...],
  "siviReference": "AFD.EntityType",
  "version": "2.0"
}
```

#### Required Entity Properties

- **id**: Unique identifier within the model (lowercase, hyphen-separated)
- **name**: Human-readable entity name following SIVI naming conventions
- **description**: Clear description of the entity's purpose in insurance context
- **type**: Must be one of the SIVI AFD 2.0 standard entity types
- **siviReference**: Official SIVI AFD reference (format: "AFD.EntityType")
- **version**: SIVI AFD version compliance (must be "2.0")

#### SIVI AFD 2.0 Standard Entity Types

The model creator validates that entity types conform to SIVI AFD 2.0 specifications:

- **Policy**: Insurance policy/contract entities
- **Coverage**: Insurance coverage details and terms
- **Party**: All parties involved in insurance transactions
- **Claim**: Insurance claim entities and processes
- **Premium**: Premium calculation and payment information
- **Object**: Insured objects, items, or assets
- **Clause**: Policy clauses, conditions, and terms

### Entity Attributes Structure

Each attribute must follow SIVI AFD 2.0 data modeling standards:

```json
{
  "name": "attributeName",
  "type": "dataType",
  "required": true|false,
  "description": "Detailed attribute description",
  "siviReference": "AFD.Entity.AttributeName",
  "example": "Sample value"
}
```

#### Attribute Validation Rules

- **name**: CamelCase naming following SIVI conventions
- **type**: Standard data types (string, number, Date, boolean)
- **required**: Boolean indicating if attribute is mandatory
- **description**: Clear description of attribute purpose
- **siviReference**: Official SIVI AFD reference mapping
- **example**: Optional sample value for documentation

### Entity Relationships Structure

Relationships define how entities connect within the insurance domain:

```json
{
  "type": "relationshipType",
  "target": "target-entity-id",
  "cardinality": "1|0..1|1..*|0..*",
  "description": "Relationship description"
}
```

#### SIVI AFD 2.0 Relationship Types

- **association**: General business relationships between entities
- **aggregation**: Part-of relationships (weaker ownership)
- **composition**: Strong ownership relationships
- **inheritance**: Type hierarchies and specializations

#### Cardinality Notation

- **1**: Exactly one
- **0..1**: Zero or one (optional)
- **1..***: One or more (required multiple)
- **0..***: Zero or more (optional multiple)

## SIVI AFD 2.0 Compliance Validation

The model creator performs comprehensive validation to ensure SIVI AFD 2.0 compliance:

### Entity Validation Rules

1. **Required Fields**: All entities must have id, name, type, and siviReference
2. **Entity Type Validation**: Type must be one of the seven SIVI AFD 2.0 standard types
3. **Naming Conventions**: Entity names must follow SIVI naming standards
4. **SIVI References**: Must follow the official "AFD.EntityType" format
5. **Version Compliance**: Must specify SIVI AFD version "2.0"

### Attribute Validation Rules

1. **Required Properties**: All attributes must have name and type
2. **Data Type Validation**: Types must be standard (string, number, Date, boolean)
3. **SIVI Reference Format**: Must follow "AFD.Entity.Attribute" pattern
4. **Naming Standards**: Attribute names must use camelCase convention
5. **Description Requirements**: All attributes should have meaningful descriptions

### Relationship Validation Rules

1. **Complete Definitions**: All relationships must specify type, target, and cardinality
2. **Valid Types**: Relationship types must be association, aggregation, composition, or inheritance
3. **Target Validation**: Target entities must exist within the same model
4. **Cardinality Format**: Must use standard UML cardinality notation
5. **Business Logic**: Relationships must make sense in insurance domain context

### Model-Level Validation Rules

1. **Unique Entity IDs**: No duplicate entity identifiers within a model
2. **Namespace Compliance**: Must use SIVI namespace format
3. **Relationship Integrity**: All relationship targets must reference existing entities
4. **SIVI Standard Alignment**: Overall model structure must align with SIVI AFD 2.0
5. **Insurance Domain Relevance**: All entities must be relevant to insurance business

## File Format

Each JSON file should contain a complete domain model with the following structure:

```json
{
  "name": "Model Name",
  "version": "1.0.0",
  "description": "Model description",
  "namespace": "nl.sivi.afd.insurance",
  "entities": [
    {
      "id": "entity-id",
      "name": "Entity Name",
      "description": "Entity description",
      "type": "Policy|Coverage|Party|Claim|Premium|Object|Clause",
      "attributes": [
        {
          "name": "attributeName",
          "type": "string|number|Date|boolean",
          "required": true|false,
          "description": "Attribute description",
          "siviReference": "AFD.Entity.Attribute",
          "example": "Sample value"
        }
      ],
      "relationships": [
        {
          "type": "association|aggregation|composition|inheritance",
          "target": "target-entity-id",
          "cardinality": "1|0..1|1..*|0..*",
          "description": "Relationship description"
        }
      ],
      "siviReference": "AFD.Entity",
      "version": "2.0"
    }
  ]
}
```

## Usage

1. Create or edit JSON model input files in this directory
2. Run `model-creator generate-svg <filename>` to generate SVG diagrams
3. Use `model-creator list-svg` to see all generated outputs
4. The model creator automatically validates SIVI AFD 2.0 compliance

## Examples

- `example-model.json` - Basic sample model demonstrating SIVI AFD 2.0 structure
- Add your own SIVI AFD 2.0 compliant model files here

## Quality Assurance

The model creator ensures that all generated models:
- Follow SIVI AFD 2.0 naming conventions
- Include proper SIVI reference mappings
- Maintain relationship integrity
- Use standard insurance entity types
- Comply with Dutch insurance industry standards
