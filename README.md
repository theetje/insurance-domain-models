# @hienfeld/model-creator

Comprehensive TypeScript tool for integrating Git-based UML domain models with Confluence using SIVI AFD 2.0.

## Overview

This tool provides a complete solution for Dutch insurance companies to create, manage, and document domain models that comply with the SIVI AFD 2.0 standard. It bridges the gap between technical domain modeling and business documentation by:

- Creating SIVI AFD 2.0 compliant domain models
- Generating UML diagrams in Mermaid and PlantUML formats
- Version controlling models and diagrams in Git
- Automatically synchronizing documentation with Confluence Cloud
- Providing a complete workflow from model creation to documentation

## Features

### 🏗️ SIVI AFD 2.0 Foundation
- Pre-built insurance domain entities (Policy, Coverage, Party, Claim, etc.)
- Industry-standard attributes and relationships
- Validation against SIVI AFD 2.0 specifications
- Extensible model structure for custom entities

### 📊 UML Diagram Generation
- Mermaid class diagrams with live rendering
- PlantUML support for complex diagrams
- Sequence diagrams for insurance processes
- Customizable styling and layout options

### 🔄 Git Integration
- Version control for all model artifacts
- Automated commit and push workflows
- Branch management and history tracking
- README generation for model repositories

### 📝 Confluence Integration
- Automatic page creation and updates
- Live diagram embedding from Git repositories
- Rich documentation with metadata
- Support for multiple Confluence Cloud apps

## Installation

```bash
npm install @hienfeld/model-creator
```

## Quick Start

### 1. Initialize Configuration

```bash
npx model-creator config --init
```

Edit the generated `.model-creator.json` file with your settings:

```json
{
  "git": {
    "repositoryUrl": "https://github.com/your-org/domain-models.git",
    "branch": "main",
    "username": "your-username",
    "token": "your-token"
  },
  "confluence": {
    "baseUrl": "https://your-org.atlassian.net/wiki",
    "username": "your-email@company.com",
    "apiToken": "your-api-token",
    "spaceKey": "MODELS"
  }
}
```

### 2. Create Your First Model

```bash
npx model-creator create "Insurance Policy Model" --description "Complete policy domain model"
```

This will:
- Create a SIVI AFD 2.0 compliant domain model
- Generate UML diagrams
- Save everything to Git
- Sync with Confluence

### 3. Generate Diagrams

```bash
npx model-creator diagram models/insurance-policy-model.model.json --format mermaid --output policy-diagram.mmd
```

## Usage

### Programmatic API

```typescript
import { ModelCreator } from '@hienfeld/model-creator';

const modelCreator = new ModelCreator();
await modelCreator.initialize();

// Create a new domain model
const model = await modelCreator.createDomainModel(
  'Vehicle Insurance Model',
  'Domain model for vehicle insurance products'
);

// Generate UML diagram
const diagram = await modelCreator.generateDiagram(model, 'mermaid');

// Complete workflow
const result = await modelCreator.createCompleteWorkflow(
  'Property Insurance Model',
  'Complete property insurance domain model'
);
```

### Command Line Interface

```bash
# Initialize new repository
model-creator init --name "Insurance Models" --description "SIVI AFD 2.0 Models"

# Create domain model
model-creator create "Life Insurance Model" --format mermaid

# Generate diagram from existing model
model-creator diagram models/life-insurance.model.json --format plantuml

# Sync with Git and Confluence
model-creator sync --message "Update domain models"

# Check integration status
model-creator status

# List all models
model-creator list

# Generate sequence diagrams
model-creator sequence policy-creation --format mermaid
```

## SIVI AFD 2.0 Entities

The tool includes pre-built entities based on SIVI AFD 2.0:

### Core Entities

| Entity | Description | SIVI Reference |
|--------|-------------|----------------|
| **Policy** | Insurance policy/contract | AFD.Policy |
| **Coverage** | Insurance coverage details | AFD.Coverage |
| **Party** | Involved parties (insured, insurer, broker) | AFD.Party |
| **Claim** | Insurance claims | AFD.Claim |
| **Premium** | Premium information | AFD.Premium |
| **Object** | Insured objects/items | AFD.Object |
| **Clause** | Policy clauses and conditions | AFD.Clause |

### Relationships

- Policy ➜ Coverage (1:many)
- Policy ➜ Party (1:many)
- Policy ➜ Premium (1:1)
- Coverage ➜ Object (1:many)
- Claim ➜ Policy (1:1)
- Claim ➜ Coverage (1:many)

## Confluence Integration

The tool supports multiple Confluence Cloud apps for embedding Git content:

### Recommended Apps

1. **Git for Confluence** (by Avisi Apps)
   - Direct Git file embedding
   - Automatic synchronization
   - Support for Mermaid/PlantUML rendering

2. **Mermaid Diagrams for Confluence** (by Stratus)
   - Dedicated Mermaid support
   - Git repository integration
   - Version history tracking

3. **Just Add+** (by Modus Create)
   - Multi-format support
   - Remote Git sources
   - Comprehensive diagram types

### Generated Documentation

The tool creates rich Confluence pages with:

- Live UML diagrams from Git
- Entity definitions and relationships
- SIVI AFD 2.0 compliance information
- Version history and metadata
- Direct links to Git repository

## Configuration

### Environment Variables

```bash
# Git Configuration
GIT_REPOSITORY_URL=https://github.com/your-org/models.git
GIT_BRANCH=main
GIT_USERNAME=your-username
GIT_TOKEN=your-token

# Confluence Configuration
CONFLUENCE_BASE_URL=https://your-org.atlassian.net/wiki
CONFLUENCE_USERNAME=your-email@company.com
CONFLUENCE_API_TOKEN=your-api-token
CONFLUENCE_SPACE_KEY=MODELS

# SIVI AFD Configuration
SIVI_AFD_BASE_URL=https://www.sivi.org/afd
SIVI_AFD_VERSION=2.0
```

### Configuration File

```json
{
  "git": {
    "repositoryUrl": "https://github.com/your-org/domain-models.git",
    "branch": "main",
    "username": "your-username",
    "token": "your-token",
    "modelsPath": "models",
    "outputPath": "output"
  },
  "confluence": {
    "baseUrl": "https://your-org.atlassian.net/wiki",
    "username": "your-email@company.com",
    "apiToken": "your-api-token",
    "spaceKey": "MODELS",
    "pageTitle": "Domain Models",
    "parentPageId": "123456"
  },
  "diagram": {
    "format": "mermaid",
    "direction": "TB",
    "showAttributes": true,
    "showMethods": false,
    "showRelationships": true,
    "includeMetadata": true
  },
  "sivi": {
    "baseUrl": "https://www.sivi.org/afd",
    "version": "2.0"
  },
  "output": {
    "directory": "./output",
    "modelsDirectory": "./models"
  },
  "logging": {
    "level": "info",
    "file": "./logs/model-creator.log"
  }
}
```

## Examples

### Basic Model Creation

```typescript
import { ModelCreator, SiviService } from '@hienfeld/model-creator';

const modelCreator = new ModelCreator();
await modelCreator.initialize();

// Create model with SIVI AFD 2.0 entities
const model = await modelCreator.createDomainModel(
  'Home Insurance Model',
  'Domain model for home insurance products'
);

// The model includes all SIVI AFD 2.0 entities by default
console.log(`Created model with ${model.entities.length} entities`);
```

### Custom Entity Extension

```typescript
import { SiviService, SiviEntity } from '@hienfeld/model-creator';

const siviService = new SiviService();
const baseModel = siviService.createDomainModel('Extended Model');

// Add custom entity
const customEntity: SiviEntity = {
  id: 'risk-assessment',
  name: 'RiskAssessment',
  description: 'Risk assessment entity',
  type: 'Other',
  attributes: [
    { name: 'riskScore', type: 'number', required: true },
    { name: 'assessmentDate', type: 'Date', required: true }
  ],
  relationships: [
    { type: 'association', target: 'policy', cardinality: '1' }
  ],
  version: '2.0'
};

const extendedModel = siviService.extendDomainModel(baseModel, [customEntity]);
```

### Diagram Customization

```typescript
const diagram = await modelCreator.generateDiagram(model, 'mermaid', {
  direction: 'LR',
  showAttributes: true,
  showMethods: true,
  showRelationships: true,
  includeMetadata: true
});
```

### Complete Workflow

```typescript
// Create, generate, save, and sync in one step
const result = await modelCreator.createCompleteWorkflow(
  'Motor Insurance Model',
  'Complete motor insurance domain model',
  'mermaid'
);

console.log('Workflow completed:');
console.log(`- Model: ${result.model.name}`);
console.log(`- Git paths: ${JSON.stringify(result.gitPaths)}`);
console.log(`- Confluence page: ${result.confluencePageId}`);
```

## Development

### Setup

```bash
git clone https://github.com/hienfeld/model-creator.git
cd model-creator
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Contact: support@hienfeld.com
- Documentation: [GitHub Wiki](https://github.com/hienfeld/model-creator/wiki)

## Roadmap

- [ ] Support for additional diagram formats (C4, BPMN)
- [ ] Integration with more Git hosting providers
- [ ] Advanced SIVI AFD 2.0 validation rules
- [ ] Export to JSON Schema and XSD
- [ ] Integration with insurance core systems
- [ ] Multi-language support for documentation

---

*Built with ❤️ for the Dutch insurance industry*
