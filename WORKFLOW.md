# Domain Model Creation Workflow

Complete input-focused workflow for creating SIVI AFD 2.0 compliant domain models using the CLI.

## 🎯 Overview

This workflow covers the complete process from input template creation to final documentation in Confluence. The process is input-focused, separating source definitions from enhanced working models for clear separation of concerns.

## 📋 Prerequisites

✅ **Setup Complete**: Follow SETUP.md first  
✅ **Configuration**: `.model-creator.json` configured  
✅ **Git Repository**: Connected and accessible  
✅ **Confluence**: Connected with required apps  

## 🚀 Quick Input-Focused Workflow

```bash
# 1. Create input template
model-creator create "Motor Insurance Model" --description "SIVI AFD 2.0 motor insurance model"

# 2. Edit the input file (customize entities, attributes, relationships)
nano inputs/motor-insurance-model.json

# 3. Generate SVG diagram
model-creator generate-svg motor-insurance-model.json

# 4. Check status
model-creator input-status

# 5. Process all inputs and sync with Git/Confluence
model-creator process-inputs
```

## 📝 Step-by-Step Workflow

### Step 1: Create Input Template

#### Basic Template Creation
```bash
# Create input template with default SIVI entities
model-creator create "Property Insurance Model"

# Create with custom description
model-creator create "WIA Insurance Model" --description "Work disability insurance with captive structure"

# Create with specific entity types
model-creator create "Health Insurance Model" --entities "Policy,Coverage,Party,Claim"
```

#### Advanced Template Creation
```bash
# Create with custom entities
model-creator create "Marine Insurance Model" \
  --description "Marine cargo and hull insurance model" \
  --entities "Policy,Coverage,Vessel,Cargo,Port,Claim"

# Overwrite existing file
model-creator create "Liability Insurance Model" --force
```

### Step 2: Customize Input Model

```bash
# Edit the generated input file
nano inputs/property-insurance-model.json

# View the input template structure
cat inputs/property-insurance-model.json | jq

# Check input file format
model-creator input-status
```

### Step 3: Generate Diagrams from Inputs

#### SVG Generation from Input Files
```bash
# Generate SVG from input file (automatic inputs/ lookup)
model-creator generate-svg property-insurance-model.json

# Generate with custom dimensions
model-creator generate-svg property-insurance-model.json --width 1600 --height 1200

# Generate PlantUML format
model-creator generate-svg property-insurance-model.json --format plantuml

# SVG only (skip Git/Confluence sync)
model-creator generate-svg property-insurance-model.json --svg-only
```

#### Bulk Processing
```bash
# Process all models in inputs/ directory
model-creator process-inputs

# Process with custom settings
model-creator process-inputs --format mermaid --width 1400 --height 1000

# SVG only (skip Git/Confluence)
model-creator process-inputs --svg-only
```

### Step 4: Review Diagrams

```bash
# Check generated SVG
open svg-output/property-insurance-model/property-insurance-model-diagram.svg

# List all generated diagrams
model-creator list-svg

# View diagram summary
cat svg-output/property-insurance-model/property-insurance-model-summary.json
```

### Step 5: Sync with Git and Confluence

```bash
# Process inputs and automatically sync with Git and Confluence
model-creator process-inputs

# Check status of all input models
model-creator input-status

# Manual Git operations (if needed)
git add .
git commit -m "Update insurance models"
git push origin main
```

## 🔄 Common Workflows

### Workflow A: Single Model from Scratch

```bash
# 1. Create the model
model-creator create "Cyber Insurance Model" \
  --description "Cyber liability and data breach coverage model"

# 2. Generate diagram
model-creator generate-svg models/cyber-insurance-model.model.json

# 3. Review and iterate
open svg-output/cyber-insurance-model/cyber-insurance-model-diagram.svg

# 4. Finalize and publish
model-creator sync --message "Add cyber insurance model"
```

### Workflow B: Batch Processing from Input Files

```bash
# 1. Prepare input files
mkdir -p inputs
cp your-models/*.json inputs/

# 2. Process all models
model-creator process-inputs

# 3. Review results
model-creator input-status

# 4. Check generated outputs
ls -la svg-output/*/
```

### Workflow C: Iterative Model Development

```bash
# 1. Create initial model
model-creator create "Travel Insurance Model"

# 2. Edit model file manually
nano models/travel-insurance-model.model.json

# 3. Regenerate diagram
model-creator generate-svg models/travel-insurance-model.model.json

# 4. Review changes
open svg-output/travel-insurance-model/travel-insurance-model-diagram.svg

# 5. Commit changes
model-creator sync --message "Update travel insurance model entities"
```

### Workflow D: Model Comparison and Updates

```bash
# 1. List existing models
model-creator list

# 2. Generate diagrams for comparison
model-creator generate-svg models/model-v1.model.json
model-creator generate-svg models/model-v2.model.json

# 3. Compare visually
open svg-output/model-v1/model-v1-diagram.svg
open svg-output/model-v2/model-v2-diagram.svg

# 4. Update documentation
model-creator sync --message "Model comparison and updates"
```

## 📊 Model Structure

### SIVI AFD 2.0 Compliant Model Format

```json
{
  "name": "Insurance Model Name",
  "version": "1.0.0",
  "description": "SIVI AFD 2.0 compliant insurance model",
  "namespace": "nl.sivi.afd.insurance",
  "entities": [
    {
      "id": "policy",
      "name": "Policy",
      "description": "Insurance policy entity",
      "type": "Policy",
      "attributes": [
        {
          "name": "contractNumber",
          "type": "string",
          "required": true,
          "description": "Unique policy contract number",
          "siviReference": "AFD.Policy.ContractNumber",
          "example": "POL-2025-001"
        }
      ],
      "relationships": [
        {
          "type": "association",
          "target": "coverage",
          "cardinality": "1..*",
          "description": "Policy has coverage"
        }
      ],
      "siviReference": "AFD.Policy",
      "version": "2.0"
    }
  ],
  "metadata": {
    "created": "2025-06-24T10:00:00.000Z",
    "updated": "2025-06-24T10:00:00.000Z",
    "author": "Model Creator",
    "siviVersion": "2.0"
  }
}
```

### Entity Types

Available SIVI AFD 2.0 entity types:
- **Policy**: Insurance contracts
- **Coverage**: Coverage definitions
- **Party**: Involved parties
- **Claim**: Insurance claims
- **Premium**: Premium information
- **Object**: Insured objects
- **Clause**: Policy clauses

### Relationship Types

- **association**: General relationship (`-->`)
- **aggregation**: Part-of relationship (`o--`)
- **composition**: Strong ownership (`*--`)
- **inheritance**: Type hierarchy (`<|--`)

## 🎨 Diagram Customization

### Mermaid Styling

Models automatically include SIVI-compliant styling:

```mermaid
classDef policyClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
classDef coverageClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
classDef partyClass fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
classDef claimClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

### Diagram Configuration

```json
{
  "diagram": {
    "format": "mermaid",
    "direction": "TB",
    "showAttributes": true,
    "showMethods": false,
    "showRelationships": true,
    "width": 1400,
    "height": 1000
  }
}
```

## 🔍 Status and Monitoring

### Check Overall Status
```bash
model-creator status
```

### Check Input Processing Status
```bash
model-creator input-status
```

### Check SVG Generation Status
```bash
model-creator list-svg
```

### Debug Confluence Integration
```bash
model-creator debug-confluence
```

## 📝 Best Practices

### 1. Naming Conventions
- Use descriptive model names: "Motor Insurance Model"
- Follow SIVI naming for entities: "Policy", "Coverage", "Party"
- Use camelCase for attributes: "contractNumber", "effectiveDate"

### 2. Model Organization
- One domain per model file
- Include comprehensive descriptions
- Use proper SIVI references
- Maintain version history

### 3. Diagram Quality
- Generate SVG for scalability
- Use consistent dimensions (1400x1000)
- Include relationships for clarity
- Apply SIVI-compliant styling

### 4. Documentation
- Commit with meaningful messages
- Update Confluence regularly
- Include metadata in models
- Document custom entities

### 5. Testing
- Validate Mermaid syntax
- Test SVG generation
- Verify Confluence integration
- Check Git synchronization

## 🚨 Troubleshooting

### Model Creation Issues
```bash
# Check configuration
model-creator status

# Verify Git connection
git remote -v

# Test Confluence connection
model-creator debug-confluence
```

### Diagram Generation Issues
```bash
# Check Mermaid syntax
# Test at: https://mermaid.live/

# Verify model structure
node -e "console.log(JSON.stringify(require('./models/your-model.json'), null, 2))"

# Check Puppeteer installation
npm list puppeteer
```

### Confluence Sync Issues
```bash
# Check API token
model-creator debug-confluence

# Verify space permissions
# Check app installations
```

## 📈 Advanced Workflows

### Custom Entity Creation
```bash
# Create model with custom entity structure
model-creator create "Custom Model" --entities "CustomEntity1,CustomEntity2"

# Edit model file to add custom attributes
nano models/custom-model.model.json

# Generate diagram
model-creator generate-svg models/custom-model.model.json
```

### Multi-Format Generation
```bash
# Generate both Mermaid and PlantUML
model-creator generate-svg models/model.json --format mermaid
model-creator generate-svg models/model.json --format plantuml

# Compare formats
open svg-output/model/model-diagram-mermaid.svg
open svg-output/model/model-diagram-plantuml.svg
```

### Automated Pipeline
```bash
#!/bin/bash
# Pipeline script for automated model processing

# Process all input models
model-creator process-inputs

# Generate status report
model-creator input-status > status-report.txt

# Commit everything
model-creator sync --message "Automated model update $(date)"

# Notify completion
echo "Model processing complete!"
```

---

*Ready to create SIVI AFD 2.0 compliant domain models! 🚀*
