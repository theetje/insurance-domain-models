# Input Model Management Guide

This document explains the comprehensive workflow for managing multiple input models, generating SVG diagrams, and organizing outputs with Git and Confluence integration.

## 🎯 Overview

The Model Creator now supports a structured approach to processing multiple input models with the following capabilities:

- **Local SVG Generation**: Generate high-quality SVG diagrams from Mermaid code
- **Organized Output Structure**: Each input model gets its own output directory
- **Full Workflow Integration**: Automatic Git commits and Confluence page updates
- **Status Tracking**: Monitor the processing status of all input models
- **Batch Processing**: Process multiple models simultaneously

## 📁 Directory Structure

```
/
├── inputs/                    # Input model JSON files
│   ├── example-model.json     # Example model
│   ├── wia-model-input.json   # Your WIA model
│   └── README.md              # Documentation
├── output/                    # Generated outputs
│   ├── svg/                   # Standalone SVG files
│   ├── png/                   # PNG files (if needed)
│   ├── reports/               # Processing reports
│   ├── example-model/         # Model-specific output
│   │   └── example-model-diagram.svg
│   ├── wia-model-input/       # Model-specific output
│   │   └── wia-model-input-diagram.svg
│   └── processing-summary.json # Overall processing status
├── models/                    # Git-managed model files
│   ├── example-model.model.json
│   └── wia-model-input.model.json
└── diagrams/                  # Git-managed diagram files
    ├── example-model-diagram.mmd
    └── wia-model-input-diagram.mmd
```

## 🚀 Available Commands

### 1. Initialize Directory Structure
```bash
# Create the input model management directory structure
model-creator init-inputs
```

### 2. Generate SVG for Single Model
```bash
# Generate SVG diagram from a specific input model
model-creator generate-svg inputs/wia-model-input.json

# Specify custom output directory
model-creator generate-svg inputs/wia-model-input.json -o custom/output/path

# Generate with custom dimensions
model-creator generate-svg inputs/wia-model-input.json --width 1600 --height 1200

# Generate PlantUML SVG
model-creator generate-svg inputs/wia-model-input.json -f plantuml
```

### 3. Process All Input Models
```bash
# Process all input models with full Git and Confluence integration
model-creator process-inputs

# Process with custom input/output directories
model-creator process-inputs -i ./my-inputs -o ./my-outputs

# Generate SVG only (skip Git and Confluence)
model-creator process-inputs --svg-only

# Dry run to see what would be processed
model-creator process-inputs --dry-run

# Use PlantUML format
model-creator process-inputs -f plantuml
```

### 4. Check Status of All Models
```bash
# Show comprehensive status of all input models
model-creator input-status

# Check status with custom directories
model-creator input-status -i ./my-inputs -o ./my-outputs
```

### 5. Debug and Troubleshooting
```bash
# Test Confluence connection and available macros
model-creator debug-confluence

# Check overall integration status
model-creator status

# List all models in Git repository
model-creator list
```

## 📋 Input Model Format

Each JSON file in the `inputs/` directory should follow this structure:

```json
{
  "name": "Model Name",
  "version": "1.0.0",
  "description": "Model description",
  "namespace": "nl.sivi.afd.namespace",
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
          "required": true,
          "description": "Attribute description",
          "siviReference": "AFD.Entity.Attribute",
          "example": "Example value"
        }
      ],
      "relationships": [
        {
          "type": "association|aggregation|composition|inheritance",
          "target": "target-entity-id",
          "cardinality": "1|0..1|1..*|*",
          "description": "Relationship description"
        }
      ],
      "siviReference": "AFD.Entity",
      "version": "2.0"
    }
  ]
}
```

## 🔄 Workflow Examples

### Process Single Model
```bash
# 1. Place your model JSON file in inputs/
cp my-model.json inputs/

# 2. Generate SVG diagram
model-creator generate-svg inputs/my-model.json

# 3. Check the generated SVG
open output/svg/my-model-diagram.svg
```

### Batch Process All Models
```bash
# 1. Place all your JSON files in inputs/
cp *.json inputs/

# 2. Process everything at once
model-creator process-inputs

# 3. Check status
model-creator input-status

# 4. View results in Confluence (automatically updated)
```

### SVG-Only Workflow
```bash
# For quick diagram generation without Git/Confluence
model-creator process-inputs --svg-only

# Check generated SVGs
ls -la output/*/
```

## 📊 Status Tracking

The `input-status` command shows comprehensive information for each model:

- ✅ **SVG Diagram**: Local SVG file generated
- ✅ **Git Model**: Model file saved to Git repository  
- ✅ **Git Diagram**: Diagram source saved to Git
- ✅ **Confluence Page**: Page updated with embedded image
- **Last Processed**: Timestamp of last successful processing

## 🎨 SVG Generation Features

- **High Quality**: 1400x1000 pixel resolution by default
- **Scalable**: Vector format for perfect scaling
- **Consistent**: Uses Mermaid 10.6.1 for reliable rendering
- **Customizable**: Adjustable dimensions and formats
- **Fast**: Local generation using Puppeteer + Mermaid

## 🔧 Configuration

The tool uses your existing `.model-creator.json` configuration file:

```json
{
  "git": {
    "repositoryUrl": "your-git-repo-url",
    "branch": "main"
  },
  "confluence": {
    "baseUrl": "your-confluence-url",
    "username": "your-username",
    "apiToken": "your-api-token",
    "spaceKey": "your-space-key"
  },
  "diagram": {
    "format": "mermaid",
    "direction": "TB"
  }
}
```

## 🚨 Error Handling

- **Syntax Errors**: If a Mermaid diagram has syntax errors, check the generated `.mmd` file
- **File Not Found**: Ensure JSON files are properly placed in the `inputs/` directory
- **Git Errors**: Check your Git configuration and credentials
- **Confluence Errors**: Verify your Confluence API token and permissions

## 📈 Processing Summary

After batch processing, check `output/processing-summary.json` for detailed results:

```json
{
  "timestamp": "2025-06-24T17:26:56.692Z",
  "inputDirectory": "/path/to/inputs",
  "outputDirectory": "/path/to/output",
  "totalFiles": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "inputFile": "wia-model-input.json",
      "modelName": "WIA Verzekering met Captive Constructie",
      "status": "success",
      "svgPath": "/path/to/svg",
      "confluencePageId": "206504046"
    }
  ]
}
```

## 🎯 Best Practices

1. **Organize Input Files**: Use descriptive filenames for your JSON models
2. **Version Control**: Input files can be version controlled separately from outputs
3. **Regular Status Checks**: Use `input-status` to monitor processing state
4. **Batch Processing**: Process multiple models together for efficiency
5. **SVG Preview**: Always check generated SVGs before publishing

## 🔍 Troubleshooting

### Common Issues

1. **Mermaid Syntax Error**: 
   - Check the generated `.mmd` file in `diagrams/`
   - Validate Mermaid syntax at https://mermaid.live/

2. **SVG Generation Fails**:
   - Ensure Puppeteer can launch Chrome/Chromium
   - Check available system resources

3. **Git/Confluence Integration Issues**:
   - Verify configuration in `.model-creator.json`
   - Test connections with `model-creator debug-confluence`

---

This comprehensive workflow gives you full control over multiple input models while maintaining organized outputs and complete traceability through Git and Confluence integration.
