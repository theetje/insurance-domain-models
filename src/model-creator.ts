import { 
  AppConfig, 
  DomainModel, 
  DiagramConfig, 
  IntegrationStatus,
  ModelCreatorError 
} from './types';
import { Logger } from './utils/logger';
import { ConfigManager } from './utils/config';
import { SiviService } from './services/sivi.service';
import { DiagramService } from './services/diagram.service';
import { GitService } from './services/git.service';
import { ConfluenceService } from './services/confluence.service';

/**
 * Main ModelCreator class that orchestrates all services
 * Provides comprehensive tool for SIVI AFD 2.0 domain model management
 */
export class ModelCreator {
  private config: AppConfig;
  private logger: Logger;
  private configManager: ConfigManager;
  private siviService: SiviService;
  private diagramService: DiagramService;
  private gitService: GitService | null = null;
  private confluenceService: ConfluenceService | null = null;

  constructor(config?: AppConfig) {
    this.configManager = ConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    if (config) {
      this.config = config;
    } else {
      // Config will be loaded later via initialize()
      this.config = {} as AppConfig;
    }

    // Initialize core services
    this.siviService = new SiviService();
    this.diagramService = new DiagramService();
  }

  /**
   * Initialize ModelCreator with configuration
   */
  async initialize(configPath?: string): Promise<void> {
    try {
      this.logger.info('Initializing ModelCreator');

      // Load configuration
      this.config = await this.configManager.loadConfig(configPath);
      
      // Initialize logger with config
      this.logger = Logger.getInstance(this.config.logging);

      // Initialize SIVI service with config
      this.siviService = new SiviService(this.config.sivi.baseUrl, this.config.sivi.version);

      // Initialize Git service if configured
      if (this.config.git && this.config.git.repositoryUrl) {
        this.logger.info('Initializing Git service...');
        this.gitService = new GitService(this.config.git, process.cwd());
        await this.gitService.initializeRepository();
        this.logger.info('Git service initialized successfully');
      }

      // Initialize Confluence service if configured
      if (this.config.confluence.baseUrl && this.config.confluence.apiToken) {
        this.confluenceService = new ConfluenceService(this.config.confluence);
        
        // Test connection
        const connected = await this.confluenceService.testConnection();
        if (!connected) {
          this.logger.warn('Confluence connection test failed');
        }
      }

      this.logger.info('ModelCreator initialized successfully');
    } catch (error) {
      const message = `Failed to initialize ModelCreator: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'INITIALIZATION_ERROR', error);
    }
  }

  /**
   * Create a new SIVI AFD 2.0 compliant domain model
   */
  async createDomainModel(name: string, description?: string): Promise<DomainModel> {
    try {
      this.logger.info(`Creating new domain model: ${name}`);
      
      const model = this.siviService.createDomainModel(name, description);
      
      // Validate the model
      this.siviService.validateDomainModel(model);
      
      this.logger.info(`Domain model created successfully: ${name}`);
      return model;
    } catch (error) {
      const message = `Failed to create domain model: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'MODEL_CREATION_ERROR', error);
    }
  }

  /**
   * Import domain model from structured data
   */
  async importDomainModel(modelData: any): Promise<DomainModel> {
    try {
      this.logger.info(`Importing domain model: ${modelData.name}`);
      
      // Create the model from the provided data
      const model: DomainModel = {
        ...modelData,
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          author: 'SIVI AFD 2.0 Model Creator',
          siviVersion: '2.0'
        }
      };
      
      // Validate the model
      this.siviService.validateDomainModel(model);
      
      this.logger.info(`Domain model imported successfully: ${model.name}`);
      return model;
    } catch (error) {
      const message = `Failed to import domain model: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'MODEL_IMPORT_ERROR', error);
    }
  }

  /**
   * Generate UML diagram from domain model
   */
  async generateDiagram(
    model: DomainModel, 
    format: 'mermaid' | 'plantuml' = 'mermaid',
    customConfig?: Partial<DiagramConfig>
  ): Promise<string> {
    try {
      this.logger.info(`Generating ${format} diagram for model: ${model.name}`);
      
      const diagramConfig: DiagramConfig = {
        format,
        theme: customConfig?.theme,
        direction: customConfig?.direction || 'TB',
        showAttributes: customConfig?.showAttributes ?? true,
        showMethods: customConfig?.showMethods ?? false,
        showRelationships: customConfig?.showRelationships ?? true,
        includeMetadata: customConfig?.includeMetadata ?? true
      };

      const diagram = this.diagramService.generateDiagram(model, diagramConfig);
      
      this.logger.info(`Diagram generated successfully for model: ${model.name}`);
      return diagram;
    } catch (error) {
      const message = `Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'DIAGRAM_GENERATION_ERROR', error);
    }
  }

  /**
   * Save domain model to Git repository
   */
  async saveDomainModelToGit(model: DomainModel, filename?: string): Promise<string> {
    try {
      if (!this.gitService) {
        throw new Error('Git service not initialized. Check Git configuration.');
      }

      this.logger.info(`Saving domain model to Git: ${model.name}`);
      
      const filePath = await this.gitService.saveDomainModel(model, filename);
      
      this.logger.info(`Domain model saved to Git: ${filePath}`);
      return filePath;
    } catch (error) {
      const message = `Failed to save model to Git: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'GIT_SAVE_ERROR', error);
    }
  }

  /**
   * Save diagram to Git repository
   */
  async saveDiagramToGit(
    diagram: string, 
    filename: string, 
    format: 'mermaid' | 'plantuml'
  ): Promise<string> {
    try {
      if (!this.gitService) {
        throw new Error('Git service not initialized. Check Git configuration.');
      }

      this.logger.info(`Saving ${format} diagram to Git: ${filename}`);
      
      const filePath = await this.gitService.saveDiagram(diagram, filename, format);
      
      this.logger.info(`Diagram saved to Git: ${filePath}`);
      return filePath;
    } catch (error) {
      const message = `Failed to save diagram to Git: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'GIT_SAVE_ERROR', error);
    }
  }

  /**
   * Commit and push changes to Git
   */
  async commitAndPushChanges(message: string, files?: string[]): Promise<void> {
    try {
      if (!this.gitService) {
        throw new Error('Git service not initialized. Check Git configuration.');
      }

      this.logger.info(`Committing changes: ${message}`);
      
      await this.gitService.commitChanges(message, files);
      await this.gitService.pushChanges();
      
      this.logger.info('Changes committed and pushed successfully');
    } catch (error) {
      const message = `Failed to commit and push changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'GIT_COMMIT_ERROR', error);
    }
  }

  /**
   * Create or update Confluence documentation
   */
  async syncWithConfluence(
    model: DomainModel,
    diagram: string,
    diagramFormat: 'mermaid' | 'plantuml',
    gitFileUrls: {
      modelUrl: string;
      diagramUrl: string;
    }
  ): Promise<string> {
    try {
      if (!this.confluenceService) {
        throw new Error('Confluence service not initialized. Check Confluence configuration.');
      }

      this.logger.info(`Syncing model with Confluence: ${model.name}`);
      
      const pageId = await this.confluenceService.createOrUpdateModelPage(
        model,
        diagram,
        diagramFormat,
        gitFileUrls
      );

      // Add labels for better organization (no hyphens allowed in Confluence labels)
      const labels = [
        'domainmodel',
        'siviafd20',
        'uml',
        diagramFormat,
        'insurance'
      ];
      
      await this.confluenceService.addLabelsToPage(pageId, labels);
      
      this.logger.info(`Model synced with Confluence successfully. Page ID: ${pageId}`);
      return pageId;
    } catch (error) {
      const message = `Failed to sync with Confluence: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'CONFLUENCE_SYNC_ERROR', error);
    }
  }

  /**
   * Complete workflow: Create model, generate diagram, save to Git, sync with Confluence
   */
  async createCompleteWorkflow(
    modelName: string,
    description?: string,
    diagramFormat: 'mermaid' | 'plantuml' = 'mermaid',
    customDiagramConfig?: Partial<DiagramConfig>
  ): Promise<{
    model: DomainModel;
    diagram: string;
    gitPaths: {
      modelPath: string;
      diagramPath: string;
    };
    confluencePageId?: string;
  }> {
    try {
      this.logger.info(`Starting complete workflow for model: ${modelName}`);

      // Step 1: Create domain model
      const model = await this.createDomainModel(modelName, description);

      // Step 2: Generate diagram
      const diagram = await this.generateDiagram(model, diagramFormat, customDiagramConfig);

      // Step 3: Save to Git (if configured)
      let gitPaths: { modelPath: string; diagramPath: string } = {
        modelPath: '',
        diagramPath: ''
      };

      if (this.gitService) {
        const modelPath = await this.saveDomainModelToGit(model);
        const diagramPath = await this.saveDiagramToGit(
          diagram,
          `${modelName.toLowerCase().replace(/\s+/g, '-')}-diagram`,
          diagramFormat
        );

        gitPaths = { modelPath, diagramPath };

        // Create README
        await this.gitService.createReadme(model);

        // Commit changes
        await this.commitAndPushChanges(`Add ${modelName} domain model and diagram`);
      }

      // Step 4: Sync with Confluence (if configured)
      let confluencePageId: string | undefined;

      if (this.confluenceService && this.gitService) {
        // Build Git file URLs (assuming GitHub/GitLab-style URLs)
        const gitFileUrls = {
          modelUrl: this.buildGitFileUrl(gitPaths.modelPath),
          diagramUrl: this.buildGitFileUrl(gitPaths.diagramPath)
        };

        confluencePageId = await this.syncWithConfluence(
          model,
          diagram,
          diagramFormat,
          gitFileUrls
        );
      }

      this.logger.info(`Complete workflow finished for model: ${modelName}`);

      return {
        model,
        diagram,
        gitPaths,
        confluencePageId
      };
    } catch (error) {
      const message = `Complete workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'WORKFLOW_ERROR', error);
    }
  }

  /**
   * Get integration status
   */
  async getIntegrationStatus(): Promise<IntegrationStatus> {
    try {
      const status: IntegrationStatus = {
        git: {
          connected: false,
          lastSync: null,
          branch: 'unknown',
          commitHash: null
        },
        confluence: {
          connected: false,
          lastUpdate: null,
          pageId: null
        },
        models: {
          count: 0,
          lastModified: null
        }
      };

      // Check Git status
      if (this.gitService) {
        try {
          const gitStatus = await this.gitService.getStatus();
          status.git = {
            connected: true,
            lastSync: new Date().toISOString(),
            branch: gitStatus.branch,
            commitHash: gitStatus.lastCommit
          };

          // Count model files
          const modelFiles = await this.gitService.listModelFiles();
          status.models.count = modelFiles.length;
        } catch (error) {
          this.logger.warn('Failed to get Git status', error);
        }
      }

      // Check Confluence status
      if (this.confluenceService) {
        try {
          const connected = await this.confluenceService.testConnection();
          status.confluence.connected = connected;
          if (connected) {
            status.confluence.lastUpdate = new Date().toISOString();
          }
        } catch (error) {
          this.logger.warn('Failed to test Confluence connection', error);
        }
      }

      return status;
    } catch (error) {
      const message = `Failed to get integration status: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'STATUS_ERROR', error);
    }
  }

  /**
   * Load existing domain model from Git
   */
  async loadDomainModelFromGit(filename: string): Promise<DomainModel> {
    try {
      if (!this.gitService) {
        throw new Error('Git service not initialized. Check Git configuration.');
      }

      this.logger.info(`Loading domain model from Git: ${filename}`);
      
      const model = await this.gitService.loadDomainModel(filename);
      
      // Validate loaded model
      this.siviService.validateDomainModel(model);
      
      this.logger.info(`Domain model loaded successfully: ${model.name}`);
      return model;
    } catch (error) {
      const message = `Failed to load model from Git: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'GIT_LOAD_ERROR', error);
    }
  }

  /**
   * List all available domain models in Git
   */
  async listDomainModels(): Promise<string[]> {
    try {
      if (!this.gitService) {
        throw new Error('Git service not initialized. Check Git configuration.');
      }

      return await this.gitService.listModelFiles();
    } catch (error) {
      const message = `Failed to list domain models: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'LIST_MODELS_ERROR', error);
    }
  }

  /**
   * Generate sequence diagram for insurance processes
   */
  generateSequenceDiagram(
    processName: 'policy-creation' | 'claim-processing',
    format: 'mermaid' | 'plantuml' = 'mermaid'
  ): string {
    try {
      this.logger.info(`Generating sequence diagram for process: ${processName}`);
      
      const diagram = this.diagramService.generateSequenceDiagram(processName, format);
      
      this.logger.info(`Sequence diagram generated for process: ${processName}`);
      return diagram;
    } catch (error) {
      const message = `Failed to generate sequence diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'SEQUENCE_DIAGRAM_ERROR', error);
    }
  }

  /**
   * Build Git file URL for GitHub/GitLab integration
   */
  private buildGitFileUrl(filePath: string): string {
    if (!this.config.git.repositoryUrl) {
      this.logger.warn('No Git repository URL configured');
      return '';
    }

    // Convert Git clone URL to web URL
    let baseUrl = this.config.git.repositoryUrl;
    
    // Handle different Git URL formats
    if (baseUrl.endsWith('.git')) {
      baseUrl = baseUrl.slice(0, -4);
    }
    
    if (baseUrl.startsWith('git@')) {
      // Convert SSH to HTTPS: git@github.com:user/repo -> https://github.com/user/repo
      baseUrl = baseUrl.replace('git@', 'https://').replace(':', '/');
    }
    
    // Extract relative path from absolute path
    const workingDir = process.cwd();
    let relativePath = filePath;
    
    if (filePath.startsWith(workingDir)) {
      relativePath = filePath.replace(workingDir + '/', '');
    } else if (filePath.startsWith('/')) {
      // If it's an absolute path but not within working directory, extract the filename
      relativePath = filePath.split('/').slice(-2).join('/'); // Get last 2 parts (folder/file)
    }
    
    // Build the raw file URL for GitHub/GitLab
    const branch = this.config.git.branch || 'main';
    
    let fileUrl = '';
    if (baseUrl.includes('github.com')) {
      fileUrl = `${baseUrl}/blob/${branch}/${relativePath}`;
    } else if (baseUrl.includes('gitlab.com')) {
      fileUrl = `${baseUrl}/-/blob/${branch}/${relativePath}`;
    } else {
      // Generic Git web interface
      fileUrl = `${baseUrl}/blob/${branch}/${relativePath}`;
    }
    
    this.logger.debug(`Built Git URL: ${filePath} -> ${fileUrl}`);
    return fileUrl;
  }

  /**
   * Get configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AppConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // Re-initialize services if needed
      if (newConfig.git) {
        this.gitService = new GitService({ ...this.config.git, ...newConfig.git });
        await this.gitService.initializeRepository();
      }

      if (newConfig.confluence) {
        this.confluenceService = new ConfluenceService({ ...this.config.confluence, ...newConfig.confluence });
      }

      this.logger.info('Configuration updated successfully');
    } catch (error) {
      const message = `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'CONFIG_UPDATE_ERROR', error);
    }
  }
}
