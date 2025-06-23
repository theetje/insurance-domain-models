import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { GitConfig, DomainModel, GitIntegrationError } from '../types';
import { Logger } from '../utils/logger';

/**
 * Service for Git integration - version control for domain models
 */
export class GitService {
  private git: SimpleGit;
  private logger: Logger;
  private config: GitConfig;
  private workingDirectory: string;

  constructor(config: GitConfig, workingDirectory: string = './') {
    this.config = config;
    this.workingDirectory = path.resolve(workingDirectory);
    this.git = simpleGit(this.workingDirectory);
    this.logger = Logger.getInstance();
  }

  /**
   * Initialize Git repository
   */
  async initializeRepository(): Promise<void> {
    try {
      this.logger.info('Initializing Git repository');
      
      // Check if already a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        await this.git.init();
        this.logger.info('Git repository initialized');
      }

      // Configure git if credentials provided
      if (this.config.username) {
        await this.git.addConfig('user.name', this.config.username);
      }
      
      // Set up remote if provided
      if (this.config.repositoryUrl) {
        try {
          const remotes = await this.git.getRemotes();
          const originExists = remotes.some(remote => remote.name === 'origin');
          
          if (!originExists) {
            await this.git.addRemote('origin', this.config.repositoryUrl);
            this.logger.info(`Added remote origin: ${this.config.repositoryUrl}`);
          }
        } catch (error) {
          this.logger.warn('Failed to add remote origin', error);
        }
      }

      // Create necessary directories
      await fs.ensureDir(path.join(this.workingDirectory, this.config.modelsPath));
      await fs.ensureDir(path.join(this.workingDirectory, this.config.outputPath));

      // Create .gitignore if not exists
      await this.createGitIgnore();

    } catch (error) {
      const message = `Failed to initialize Git repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Clone repository
   */
  async cloneRepository(targetDirectory?: string): Promise<void> {
    try {
      const cloneDir = targetDirectory || this.workingDirectory;
      this.logger.info(`Cloning repository ${this.config.repositoryUrl} to ${cloneDir}`);

      await fs.ensureDir(cloneDir);
      
      const cloneOptions: any = {
        '--branch': this.config.branch,
        '--single-branch': null
      };

      if (!this.config.repositoryUrl) {
        throw new GitIntegrationError('Repository URL is required for cloning');
      }

      if (this.config.token) {
        // For token-based authentication, modify the URL
        const urlWithToken = this.addTokenToUrl(this.config.repositoryUrl!, this.config.token);
        await this.git.clone(urlWithToken, cloneDir, cloneOptions);
      } else {
        await this.git.clone(this.config.repositoryUrl, cloneDir, cloneOptions);
      }

      this.logger.info('Repository cloned successfully');
    } catch (error) {
      const message = `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Save domain model to Git
   */
  async saveDomainModel(model: DomainModel, filename?: string): Promise<string> {
    try {
      const modelFile = filename || `${model.name.toLowerCase().replace(/\s+/g, '-')}.model.json`;
      const modelPath = path.join(this.workingDirectory, this.config.modelsPath, modelFile);
      
      this.logger.info(`Saving domain model to ${modelPath}`);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(modelPath));

      // Save model with pretty formatting
      const modelContent = JSON.stringify(model, null, 2);
      await fs.writeFile(modelPath, modelContent, 'utf-8');

      this.logger.info(`Domain model saved: ${modelPath}`);
      return modelPath;
    } catch (error) {
      const message = `Failed to save domain model: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Load domain model from Git
   */
  async loadDomainModel(filename: string): Promise<DomainModel> {
    try {
      const modelPath = path.join(this.workingDirectory, this.config.modelsPath, filename);
      
      this.logger.info(`Loading domain model from ${modelPath}`);

      if (!await fs.pathExists(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      const modelContent = await fs.readFile(modelPath, 'utf-8');
      const model = JSON.parse(modelContent) as DomainModel;

      this.logger.info(`Domain model loaded: ${model.name}`);
      return model;
    } catch (error) {
      const message = `Failed to load domain model: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Save diagram to Git
   */
  async saveDiagram(content: string, filename: string, format: 'mermaid' | 'plantuml'): Promise<string> {
    try {
      const extension = format === 'mermaid' ? '.mmd' : '.puml';
      const diagramFile = filename.endsWith(extension) ? filename : `${filename}${extension}`;
      const diagramPath = path.join(this.workingDirectory, this.config.outputPath, diagramFile);
      
      this.logger.info(`Saving ${format} diagram to ${diagramPath}`);

      // Ensure directory exists
      await fs.ensureDir(path.dirname(diagramPath));

      // Save diagram content
      await fs.writeFile(diagramPath, content, 'utf-8');

      this.logger.info(`Diagram saved: ${diagramPath}`);
      return diagramPath;
    } catch (error) {
      const message = `Failed to save diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Commit changes
   */
  async commitChanges(message: string, files?: string[]): Promise<void> {
    try {
      this.logger.info(`Committing changes: ${message}`);

      // Add files to staging
      if (files && files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }

      // Check if there are changes to commit
      const status = await this.git.status();
      if (status.staged.length === 0) {
        this.logger.info('No changes to commit');
        return;
      }

      // Commit changes
      await this.git.commit(message);
      this.logger.info('Changes committed successfully');
    } catch (error) {
      const message = `Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Push changes to remote
   */
  async pushChanges(remote: string = 'origin', branch?: string): Promise<void> {
    try {
      const targetBranch = branch || this.config.branch;
      this.logger.info(`Pushing changes to ${remote}/${targetBranch}`);

      await this.git.push(remote, targetBranch);
      this.logger.info('Changes pushed successfully');
    } catch (error) {
      const message = `Failed to push changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Pull changes from remote
   */
  async pullChanges(remote: string = 'origin', branch?: string): Promise<void> {
    try {
      const targetBranch = branch || this.config.branch;
      this.logger.info(`Pulling changes from ${remote}/${targetBranch}`);

      await this.git.pull(remote, targetBranch);
      this.logger.info('Changes pulled successfully');
    } catch (error) {
      const message = `Failed to pull changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    modified: string[];
    untracked: string[];
    lastCommit: string | null;
  }> {
    try {
      const status = await this.git.status();
      const branch = status.current || 'unknown';
      
      let lastCommit: string | null = null;
      try {
        const log = await this.git.log(['--max-count=1']);
        lastCommit = log.latest?.hash || null;
      } catch {
        // Ignore error if no commits exist
      }

      return {
        branch,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        lastCommit
      };
    } catch (error) {
      const message = `Failed to get repository status: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Create or switch to branch
   */
  async switchToBranch(branchName: string, create: boolean = false): Promise<void> {
    try {
      this.logger.info(`Switching to branch: ${branchName}${create ? ' (creating)' : ''}`);

      if (create) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.checkout(branchName);
      }

      this.logger.info(`Switched to branch: ${branchName}`);
    } catch (error) {
      const message = `Failed to switch to branch: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * List all model files in the repository
   */
  async listModelFiles(): Promise<string[]> {
    try {
      const modelsDir = path.join(this.workingDirectory, this.config.modelsPath);
      
      if (!await fs.pathExists(modelsDir)) {
        return [];
      }

      const files = await fs.readdir(modelsDir);
      return files.filter(file => file.endsWith('.model.json'));
    } catch (error) {
      const message = `Failed to list model files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Get file history for a specific model
   */
  async getModelHistory(filename: string): Promise<Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
  }>> {
    try {
      const modelPath = path.join(this.config.modelsPath, filename);
      const log = await this.git.log(['--', modelPath]);

      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name
      }));
    } catch (error) {
      const message = `Failed to get model history: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new GitIntegrationError(message, error);
    }
  }

  /**
   * Create .gitignore file
   */
  private async createGitIgnore(): Promise<void> {
    const gitignorePath = path.join(this.workingDirectory, '.gitignore');
    
    if (await fs.pathExists(gitignorePath)) {
      return;
    }

    const gitignoreContent = `# Model Creator
node_modules/
dist/
*.log
.env
.DS_Store
*.tmp
*.temp

# IDE
.vscode/
.idea/
*.swp
*.swo

# Generated files
*.png
*.svg
*.pdf
`;

    await fs.writeFile(gitignorePath, gitignoreContent);
    this.logger.info('.gitignore file created');
  }

  /**
   * Add token to Git URL for authentication
   */
  private addTokenToUrl(url: string, token: string): string {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname === 'github.com') {
        urlObj.username = token;
        urlObj.password = 'x-oauth-basic';
      } else if (urlObj.hostname === 'gitlab.com') {
        urlObj.username = 'oauth2';
        urlObj.password = token;
      } else {
        // Generic token-based auth
        urlObj.username = 'token';
        urlObj.password = token;
      }
      
      return urlObj.toString();
    } catch {
      // If URL parsing fails, return original URL
      return url;
    }
  }

  /**
   * Create README.md for the model repository
   */
  async createReadme(model: DomainModel): Promise<void> {
    const readmePath = path.join(this.workingDirectory, 'README.md');
    
    const readmeContent = `# ${model.name} - Domain Model

${model.description || 'Insurance domain model based on SIVI AFD 2.0'}

## Overview

This repository contains the domain model for ${model.name}, built using the SIVI AFD 2.0 standard for Dutch insurance industry.

## Structure

- \`${this.config.modelsPath}/\` - Domain model definitions (JSON format)
- \`${this.config.outputPath}/\` - Generated UML diagrams (Mermaid/PlantUML)

## Entities

${model.entities.map(entity => `- **${entity.name}**: ${entity.description || 'SIVI AFD 2.0 standard entity'}`).join('\n')}

## SIVI AFD 2.0 Compliance

This model is based on SIVI AFD ${model.metadata.siviVersion} and follows the Dutch insurance industry standards.

## Generated Diagrams

The UML diagrams in this repository are automatically generated from the domain model and can be embedded in Confluence using Git integration plugins.

## Version History

- Version ${model.version} - ${model.metadata.created}

## Integration with Confluence

This repository is integrated with Confluence to provide live documentation. The diagrams and model definitions are automatically synchronized.

---

*Generated by @hienfeld/model-creator*
`;

    await fs.writeFile(readmePath, readmeContent);
    this.logger.info('README.md created');
  }
}
