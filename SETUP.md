# Model Creator Setup Guide

Complete setup guide for the SIVI AFD 2.0 Domain Model Creator Tool.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Initialize configuration
cp .model-creator.example.json .model-creator.json

# 4. Configure Git and Confluence (see sections below)

# 5. Test the setup
node dist/cli.js status
```

## 📋 Prerequisites

- **Node.js**: Version 18 or higher
- **Git**: For version control integration
- **Confluence Cloud**: For documentation synchronization
- **GitHub/GitLab**: For model repository hosting

## 🔧 Installation

### 1. Clone or Download
```bash
git clone <repository-url>
cd model-creator
npm install
npm run build
```

### 2. Global Installation (Optional)
```bash
npm install -g .
# Now you can use 'model-creator' command globally
```

## ⚙️ Configuration

### 1. Basic Configuration File

Create `.model-creator.json` in your project root:

```json
{
  "git": {
    "repositoryUrl": "https://github.com/your-username/your-models-repo.git",
    "branch": "main",
    "username": "your-username",
    "token": "your-personal-access-token"
  },
  "confluence": {
    "baseUrl": "https://your-company.atlassian.net/wiki",
    "username": "your-email@company.com",
    "apiToken": "your-confluence-api-token",
    "spaceKey": "MODELS"
  },
  "diagram": {
    "format": "mermaid",
    "direction": "TB",
    "showAttributes": true,
    "showMethods": false,
    "showRelationships": true
  }
}
```

### 2. Git Repository Setup

#### Create GitHub Repository
1. Go to GitHub.com → New Repository
2. Name: `insurance-domain-models` (or your preferred name)
3. Initialize with README
4. Copy the repository URL

#### Generate Personal Access Token
1. GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `workflow`
4. Copy token and add to configuration

#### GitLab Alternative
1. GitLab Project → Settings → Access Tokens
2. Create token with `api`, `read_repository`, `write_repository` scopes
3. Use GitLab URL format: `https://gitlab.com/username/project.git`

### 3. Confluence Setup

#### Get API Token
1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Copy token (starts with `ATATT3xFfGF0...`)

#### Find Space Key
1. Go to your Confluence space
2. Look at URL: `https://company.atlassian.net/wiki/spaces/SPACEKEY/`
3. Use just the `SPACEKEY` part (e.g., "MODELS", "DOCS")

#### Required Confluence Apps
Install one of these from Atlassian Marketplace:

- **Git for Confluence** (Avisi Apps) - Recommended
- **Mermaid Diagrams for Confluence** (Stratus)
- **Just Add+** (Modus Create)

### 4. Test Configuration

```bash
# Test Git connection
node dist/cli.js status

# Test Confluence connection  
node dist/cli.js debug-confluence

# Verify setup
node dist/cli.js list
```

## 📁 Directory Structure

After setup, your project will have:

```
your-project/
├── .model-creator.json        # Configuration file
├── inputs/                    # Input model JSON files
│   ├── README.md             # Input documentation
│   └── *.json                # Your model files
├── models/                    # Git-managed model files
├── diagrams/                  # Git-managed diagram source files
├── svg-output/               # Generated SVG diagrams
└── logs/                     # Application logs
```

## 🔄 SIVI AFD 2.0 Entities

The tool includes pre-built entities based on Dutch insurance standards:

### Core Entities
- **Policy**: Insurance policy/contract
- **Coverage**: Coverage details and terms
- **Party**: Involved parties (insured, insurer, broker)
- **Claim**: Insurance claims
- **Premium**: Premium calculations and payments
- **Object**: Insured objects/items
- **Clause**: Policy clauses and conditions

### Entity Attributes
Each entity includes SIVI AFD 2.0 compliant attributes:
- Unique identifiers
- Required/optional field definitions
- Data types (string, number, Date, boolean)
- SIVI reference mappings
- Example values

### Relationships
- **Association**: General relationships
- **Aggregation**: Part-of relationships
- **Composition**: Strong ownership
- **Inheritance**: Type hierarchies

## 🎨 Diagram Generation

### Supported Formats
- **Mermaid**: Modern, web-friendly diagrams
- **PlantUML**: Traditional UML format

### Diagram Types
- **Class Diagrams**: Entity relationships and attributes
- **Sequence Diagrams**: Process flows (policy creation, claim processing)

### SVG Output
- High-quality vector graphics (1400x1000px default)
- Scalable for presentations and documentation
- Embedded in Confluence pages

## 🔐 Security & Authentication

### Git Authentication
```json
{
  "git": {
    "username": "your-username",
    "token": "ghp_your_github_token"
  }
}
```

### Confluence Authentication
```json
{
  "confluence": {
    "username": "your-email@company.com",
    "apiToken": "ATATT3xFfGF0your_token"
  }
}
```

### Environment Variables (Alternative)
```bash
export GIT_TOKEN="your-git-token"
export CONFLUENCE_API_TOKEN="your-confluence-token"
```

## 🚨 Troubleshooting

### Common Issues

#### Git Authentication Failed
```bash
# Check token permissions
# Regenerate token with correct scopes
# Verify repository URL format
```

#### Confluence Connection Failed  
```bash
# Verify API token is valid
# Check space key format (just "MODELS", not "spaces/MODELS")
# Ensure required apps are installed
```

#### SVG Generation Failed
```bash
# Check Puppeteer Chrome installation
# Verify Mermaid syntax in generated .mmd files
# Check system resources
```

#### Mermaid Syntax Errors
```bash
# Test syntax at https://mermaid.live/
# Check attribute names for special characters
# Validate relationship definitions
```

### Debug Commands
```bash
# Overall status
node dist/cli.js status

# Confluence debugging
node dist/cli.js debug-confluence

# List all models
node dist/cli.js list

# Generate single SVG
node dist/cli.js generate-svg inputs/your-model.json
```

## 📊 Verification

After setup, verify everything works:

1. **Create Test Model**:
   ```bash
   node dist/cli.js create "Test Model" --description "Setup verification"
   ```

2. **Generate Diagram**:
   ```bash
   node dist/cli.js generate-svg models/test-model.model.json
   ```

3. **Check Git Integration**:
   ```bash
   # Should show committed files
   git log --oneline
   ```

4. **Verify Confluence**:
   - Check your Confluence space for new pages
   - Verify diagrams are embedded correctly

## 🧪 Testing

Run the test suite to verify installation:

```bash
# Run all tests
npm test

# Run specific test categories
npm test -- --testNamePattern="Config"
npm test -- --testNamePattern="Diagram"
```

## 📦 Package Information

- **Name**: @hienfeld/model-creator
- **Version**: 1.0.0
- **License**: MIT
- **Dependencies**: TypeScript, Puppeteer, Mermaid, Axios
- **Node Version**: >=18.0.0

## 🔄 Updates

To update the tool:

```bash
git pull origin main
npm install
npm run build
```

Check for configuration changes in the changelog and update your `.model-creator.json` accordingly.

## 🆘 Support

For issues and questions:

1. Check this setup guide
2. Review the troubleshooting section
3. Check the workflow documentation
4. Verify configuration format
5. Test with minimal examples

---

*Setup complete! Proceed to WORKFLOW.md for usage instructions.*
