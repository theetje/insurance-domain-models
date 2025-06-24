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
import fs from 'fs-extra';
import path from 'path';

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
  async initialize(configPath?: string, logLevel?: string): Promise<void> {
    try {
      this.logger.info('Initializing ModelCreator');

      // Load configuration
      this.config = await this.configManager.loadConfig(configPath);
      
      // Initialize logger with config and optional override
      const loggerConfig = {
        ...this.config.logging,
        ...(logLevel && { level: logLevel as 'error' | 'warn' | 'info' | 'debug' })
      };
      this.logger = Logger.getInstance(loggerConfig);

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
   * Get integration status with all services
   */
  async getIntegrationStatus(): Promise<IntegrationStatus> {
    const status: IntegrationStatus = {
      git: {
        connected: false,
        lastSync: null,
        branch: 'main',
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

    try {
      // Test Git integration
      if (this.gitService) {
        const gitStatus = await this.gitService.getStatus();
        status.git.connected = gitStatus !== null;
        if (gitStatus) {
          status.git.branch = gitStatus.branch || 'main';
          status.git.commitHash = gitStatus.lastCommit || null;
        }
      }

      // Test Confluence integration
      if (this.confluenceService) {
        status.confluence.connected = await this.confluenceService.testConnection();
      }

      // Count models (this is basic - could be enhanced)
      try {
        const fs = await import('fs-extra');
        const modelsDir = './models';
        if (await fs.pathExists(modelsDir)) {
          const files = await fs.readdir(modelsDir);
          status.models.count = files.filter(f => f.endsWith('.json')).length;
        }
      } catch {
        // Ignore if models directory doesn't exist
      }

    } catch (error) {
      this.logger.error('Error getting integration status', error);
    }

    return status;
  }

  /**
   * Test Confluence connection
   */
  async testConfluenceConnection(): Promise<boolean> {
    if (!this.confluenceService) {
      throw new ModelCreatorError('Confluence service not initialized', 'CONFLUENCE_NOT_CONFIGURED');
    }
    return this.confluenceService.testConnection();
  }

  /**
   * Get available Confluence macros
   */
  async getConfluenceMacros(): Promise<string[]> {
    if (!this.confluenceService) {
      throw new ModelCreatorError('Confluence service not initialized', 'CONFLUENCE_NOT_CONFIGURED');
    }
    return this.confluenceService.fetchAvailableMacros();
  }

  /**
   * List all available domain models
   */
  async listDomainModels(): Promise<string[]> {
    try {
      const fs = await import('fs-extra');
      const modelsDir = './models';
      
      if (!(await fs.pathExists(modelsDir))) {
        return [];
      }
      
      const files = await fs.readdir(modelsDir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    } catch (error) {
      this.logger.error('Failed to list domain models', error);
      return [];
    }
  }

  /**
   * Load domain model from Git repository
   */
  async loadDomainModelFromGit(modelName: string): Promise<DomainModel> {
    try {
      const fs = await import('fs-extra');
      const modelPath = `./models/${modelName}.json`;
      
      if (!(await fs.pathExists(modelPath))) {
        throw new ModelCreatorError(`Model not found: ${modelName}`, 'MODEL_NOT_FOUND');
      }
      
      const modelData = await fs.readJson(modelPath);
      this.logger.info(`Loaded domain model: ${modelName}`);
      return modelData;
    } catch (error) {
      const message = `Failed to load domain model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ModelCreatorError(message, 'MODEL_LOAD_ERROR', error);
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
    const workingDir = process.cwd().replace(/\\/g, '/'); // Normalize path separators
    let relativePath = filePath.replace(/\\/g, '/'); // Normalize path separators
    
    if (relativePath.startsWith(workingDir)) {
      relativePath = relativePath.replace(workingDir + '/', '');
    } else if (relativePath.startsWith('/')) {
      // If it's an absolute path but not within working directory, extract the filename
      const pathParts = relativePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      // Try to determine folder based on file extension
      if (fileName.endsWith('.model.json')) {
        relativePath = `models/${fileName}`;
      } else if (fileName.endsWith('.mmd') || fileName.endsWith('.puml')) {
        relativePath = `diagrams/${fileName}`;
      } else {
        relativePath = pathParts.slice(-2).join('/'); // Get last 2 parts (folder/file)
      }
    }
    
    // Ensure relativePath doesn't start with /
    relativePath = relativePath.replace(/^\/+/, '');
    
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
    this.config = { ...this.config, ...newConfig };
    await this.configManager.saveConfig(this.config, '.model-creator.json');
    this.logger.info('Configuration updated successfully');
  }

  /**
   * Generate SVG diagram from model data
   */
  async generateSvgFromModel(
    modelData: any,
    outputPath: string,
    format: 'mermaid' | 'plantuml' = 'mermaid',
    width: number = 1400,
    height: number = 1000
  ): Promise<string> {
    try {
      this.logger.info(`Generating SVG diagram for model: ${modelData.name}`);

      // Import the model data
      const model = await this.importDomainModel(modelData);

      // Generate diagram code
      const diagram = await this.generateDiagram(model, format);

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Use DiagramImageService to generate SVG
      const DiagramImageService = await import('./services/diagram-image.service');
      const imageService = new DiagramImageService.DiagramImageService();

      if (format === 'mermaid') {
        await imageService.generateMermaidImage(diagram, outputPath, 'svg', width, height);
      } else {
        await imageService.generatePlantUMLImage(diagram, outputPath, 'svg');
      }

      this.logger.info(`SVG diagram generated successfully: ${outputPath}`);
      return outputPath;

    } catch (error) {
      const message = `Failed to generate SVG diagram: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }

  /**
   * Process multiple input models and generate organized outputs
   */
  async processInputModels(
    inputDir: string,
    outputDir: string,
    options: {
      format?: 'mermaid' | 'plantuml';
      svgOnly?: boolean;
      width?: number;
      height?: number;
    } = {}
  ): Promise<Array<{
    inputFile: string;
    modelName: string;
    status: 'success' | 'failed';
    svgPath?: string;
    gitPaths?: { modelPath: string; diagramPath: string };
    confluencePageId?: string;
    error?: string;
  }>> {
    const {
      format = 'mermaid',
      svgOnly = false,
      width = 1400,
      height = 1000
    } = options;

    const results = [];

    try {
      if (!await fs.pathExists(inputDir)) {
        throw new Error(`Input directory not found: ${inputDir}`);
      }

      // Find all JSON files in input directory
      const inputFiles = await fs.readdir(inputDir);
      const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

      this.logger.info(`Found ${jsonFiles.length} input model files to process`);

      for (const jsonFile of jsonFiles) {
        const inputPath = path.join(inputDir, jsonFile);
        const baseName = path.basename(jsonFile, '.json');

        try {
          this.logger.info(`Processing: ${jsonFile}`);

          // Load and parse the input file
          const inputContent = await fs.readFile(inputPath, 'utf-8');
          const modelData = JSON.parse(inputContent);

          // Create model from input data
          const model = await this.importDomainModel(modelData);

          // Generate diagram
          const diagram = await this.generateDiagram(model, format);

          // Create output directory for this model
          const modelOutputDir = path.join(outputDir, baseName);
          await fs.ensureDir(modelOutputDir);

          // Generate SVG
          const svgPath = path.join(modelOutputDir, `${baseName}-diagram.svg`);
          await this.generateSvgFromModel(modelData, svgPath, format, width, height);

          let gitPaths = { modelPath: '', diagramPath: '' };
          let confluencePageId = '';

          if (!svgOnly) {
            // Save to Git
            const modelPath = await this.saveDomainModelToGit(model, `${baseName}.model.json`);
            const diagramPath = await this.saveDiagramToGit(
              diagram,
              `${baseName}-diagram`,
              format
            );

            gitPaths = { modelPath, diagramPath };

            // Commit changes
            await this.commitAndPushChanges(`Add ${model.name} domain model and diagram`);

            // Sync with Confluence
            const gitFileUrls = {
              modelUrl: this.buildGitFileUrl(modelPath),
              diagramUrl: this.buildGitFileUrl(diagramPath)
            };

            confluencePageId = await this.syncWithConfluence(
              model,
              diagram,
              format,
              gitFileUrls
            );
          }

          const result = {
            inputFile: jsonFile,
            modelName: model.name,
            status: 'success' as const,
            svgPath,
            gitPaths,
            confluencePageId
          };

          results.push(result);
          this.logger.info(`✅ Successfully processed: ${jsonFile}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`❌ Failed to process ${jsonFile}`, error);
          
          results.push({
            inputFile: jsonFile,
            modelName: 'Unknown',
            status: 'failed' as const,
            error: errorMessage
          });
        }
      }

      return results;

    } catch (error) {
      const message = `Failed to process input models: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }

  /**
   * Get status of input models and their outputs
   */
  async getInputModelsStatus(
    inputDir: string,
    outputDir: string
  ): Promise<Array<{
    inputFile: string;
    modelName: string;
    version: string;
    entitiesCount: number;
    hasSvg: boolean;
    hasGitModel: boolean;
    hasGitDiagram: boolean;
    confluencePageId?: string;
    lastProcessed?: string;
    svgPath?: string;
    gitModelPath?: string;
    gitDiagramPath?: string;
  }>> {
    const status = [];

    try {
      if (!await fs.pathExists(inputDir)) {
        throw new Error(`Input directory not found: ${inputDir}`);
      }

      // Find all JSON files in input directory
      const inputFiles = await fs.readdir(inputDir);
      const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

      // Load processing summary if it exists
      let processingSummary: any = null;
      const summaryPath = path.join(outputDir, 'processing-summary.json');
      if (await fs.pathExists(summaryPath)) {
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        processingSummary = JSON.parse(summaryContent);
      }

      for (const jsonFile of jsonFiles) {
        const inputPath = path.join(inputDir, jsonFile);
        const baseName = path.basename(jsonFile, '.json');
        const modelOutputDir = path.join(outputDir, baseName);

        try {
          // Load input model
          const inputContent = await fs.readFile(inputPath, 'utf-8');
          const modelData = JSON.parse(inputContent);

          // Check for SVG output
          const svgPath = path.join(modelOutputDir, `${baseName}-diagram.svg`);
          const hasSvg = await fs.pathExists(svgPath);

          // Check for Git model file
          const gitModelPath = path.join(process.cwd(), 'models', `${baseName}.model.json`);
          const hasGitModel = await fs.pathExists(gitModelPath);

          // Check for Git diagram file
          const gitDiagramPath = path.join(process.cwd(), 'diagrams', `${baseName}-diagram.mmd`);
          const hasGitDiagram = await fs.pathExists(gitDiagramPath);

          // Get processing info from summary
          let confluencePageId: string | undefined;
          let lastProcessed: string | undefined;

          if (processingSummary) {
            const result = processingSummary.results.find((r: any) => r.inputFile === jsonFile);
            if (result) {
              confluencePageId = result.confluencePageId;
              lastProcessed = processingSummary.timestamp;
            }
          }

          status.push({
            inputFile: jsonFile,
            modelName: modelData.name,
            version: modelData.version,
            entitiesCount: modelData.entities.length,
            hasSvg,
            hasGitModel,
            hasGitDiagram,
            confluencePageId,
            lastProcessed,
            svgPath: hasSvg ? svgPath : undefined,
            gitModelPath: hasGitModel ? gitModelPath : undefined,
            gitDiagramPath: hasGitDiagram ? gitDiagramPath : undefined
          });

        } catch (error) {
          this.logger.error(`Failed to get status for ${jsonFile}`, error);
          
          status.push({
            inputFile: jsonFile,
            modelName: 'Error loading model',
            version: 'Unknown',
            entitiesCount: 0,
            hasSvg: false,
            hasGitModel: false,
            hasGitDiagram: false
          });
        }
      }

      return status;

    } catch (error) {
      const message = `Failed to get input models status: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }
}
