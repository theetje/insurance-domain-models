# Model Inputs

This directory contains JSON model input files for the SIVI AFD 2.0 Model Creator.

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
      "type": "EntityType",
      "attributes": [...],
      "relationships": [...],
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

## Examples

- `example-model.json` - Basic sample model
- Add your own model files here
