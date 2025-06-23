# Git and Confluence Integration Setup Guide

## 🔧 Setting Up Git Integration

### 1. Create a Git Repository

First, create a repository for your domain models:

```bash
# Option A: Create on GitHub
# Go to GitHub.com → New Repository → "insurance-domain-models"

# Option B: Create locally and push (✅ You've done this!)
git init
git remote add origin https://github.com/theetje/insurance-domain-models.git
```

### 2. Configure Git Authentication

#### GitHub Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with permissions: `repo`, `workflow`
3. Copy the token for configuration

#### GitLab Access Token
1. Go to GitLab User Settings → Access Tokens
2. Create token with `api`, `read_repository`, `write_repository` scopes

### 3. Update Configuration

```json
{
  "git": {
    "repositoryUrl": "https://github.com/theetje/insurance-domain-models.git",
    "branch": "main",
    "username": "theetje",
    "token": "ghp_your_personal_access_token",
    "modelsPath": "models",
    "outputPath": "diagrams"
  }
}
```

## 🏢 Setting Up Confluence Integration

### 1. Get Confluence API Token

1. Go to Atlassian Account Settings: https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Copy the token

### 2. Find Your Confluence Details

**Space Key (Required):**
1. Go to your Confluence space
2. Look at the URL: `https://your-company.atlassian.net/wiki/spaces/SPACEKEY/`
3. The `SPACEKEY` part is what you need (e.g., "MODELS", "DOCS", "TEAM")
4. **Use ONLY the key, no additional scope needed**

**Alternative way to find Space Key:**
1. Go to your space → Space Settings → Overview
2. The space key is displayed there

**Parent Page ID (Optional):**
1. Go to the parent page → ... menu → View Page Information  
2. Copy the page ID from the URL (long number like `123456789`)

**Examples:**
```bash
Space Key: MODELS          # ✅ Correct - just the key
Space Key: DOCS            # ✅ Correct - just the key  
Space Key: TEAM            # ✅ Correct - just the key

# ❌ Wrong - these include scope/URL parts:
Space Key: spaces/MODELS   # Don't include "spaces/"
Space Key: wiki/spaces/MODELS  # Don't include URL parts
```

### 3. Install Required Confluence Apps

Install these apps from Atlassian Marketplace:

#### Option A: Git for Confluence (Recommended)
- **App**: Git for Confluence by Avisi Apps
- **Features**: Direct Git file embedding, auto-sync
- **Pricing**: Paid app with free trial

#### Option B: Mermaid Diagrams for Confluence
- **App**: Mermaid Diagrams for Confluence by Stratus
- **Features**: Mermaid-specific, Git integration
- **Pricing**: Paid app

#### Option C: Just Add+
- **App**: Just Add+ by Modus Create
- **Features**: Multi-format support, remote sources
- **Pricing**: Paid app with extensive features

### 4. Configure Confluence Settings

```json
{
  "confluence": {
    "baseUrl": "https://your-company.atlassian.net/wiki",
    "username": "your-email@company.com",
    "apiToken": "ATATT3xFfGF0your-api-token-here",
    "spaceKey": "MODELS",
    "pageTitle": "Insurance Domain Models",
    "parentPageId": "123456789"
  }
}
```

## 🔍 Quick Troubleshooting

### ✅ Space Key Format Examples

```json
{
  "confluence": {
    "spaceKey": "MODELS"        // ✅ Correct
  }
}
```

```json
{
  "confluence": {
    "spaceKey": "DS"           // ✅ Correct (short keys work too)
  }
}
```

```json
{
  "confluence": {
    "spaceKey": "TEAMDOCS"     // ✅ Correct (longer keys work)
  }
}
```

### ❌ Common Space Key Mistakes

```json
{
  "confluence": {
    "spaceKey": "spaces/MODELS"           // ❌ Wrong - don't include "spaces/"
  }
}
```

```json
{
  "confluence": {
    "spaceKey": "wiki/spaces/MODELS"     // ❌ Wrong - don't include URL parts
  }
}
```

```json
{
  "confluence": {
    "spaceKey": "/wiki/spaces/MODELS/"   // ❌ Wrong - no slashes needed
  }
}
```

### 🔧 API Token vs Space Key

- **API Token**: Your personal Confluence API token for authentication (starts with `ATATT3xFfGF0...`)
- **Space Key**: Just the space identifier (like `MODELS`, `DOCS`, `TEAM`)

**The API token provides the "scope" - you don't add scope to the space key!**

## 🚀 Complete Configuration Example

Save this as `model-creator.config.json`:

```json
{
  "git": {
    "repositoryUrl": "https://github.com/theetje/insurance-domain-models.git",
    "branch": "main",
    "username": "theetje",
    "token": "ghp_your_github_token_here",
    "modelsPath": "models",
    "outputPath": "diagrams"
  },
  "confluence": {
    "baseUrl": "https://hienfeld.atlassian.net/wiki",
    "username": "thomas@hienfeld.com",
    "apiToken": "ATATT3xFfGF0your_confluence_token_here",
    "spaceKey": "MODELS",
    "pageTitle": "SIVI AFD 2.0 Domain Models",
    "parentPageId": "98765432"
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
