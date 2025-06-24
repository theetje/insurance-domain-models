# Input Models Directory

This directory contains JSON files that define domain models for processing.

## Structure

- `*.json` - Domain model input files
- Each file should follow the SIVI AFD 2.0 model structure

## Usage

1. Place your domain model JSON files in this directory
2. Run `model-creator process-inputs` to generate SVG diagrams and sync with Git/Confluence
3. Use `model-creator input-status` to check the status of all input models
4. Use `model-creator generate-svg <input-file>` to generate SVG for a specific model

## Example Commands

```bash
# Generate SVG for a specific model
model-creator generate-svg inputs/my-model.json -o output/svg

# Process all input models
model-creator process-inputs

# Check status of all input models
model-creator input-status

# Generate SVG only (skip Git and Confluence)
model-creator process-inputs --svg-only
```

## File Format

Each JSON file should contain a domain model with the following structure:

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
      "attributes": [...],
      "relationships": [...],
      "siviReference": "AFD.Entity",
      "version": "2.0"
    }
  ]
}
```
