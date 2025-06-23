import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { AppConfig, AppConfigSchema } from '../types';
import { Logger } from './logger';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig | null = null;
  private logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async loadConfig(configPath?: string): Promise<AppConfig> {
    try {
      // Load environment variables
      dotenv.config();

      let configData: any = {};

      // Try to load from file if provided
      if (configPath && await fs.pathExists(configPath)) {
        this.logger.info(`Loading configuration from ${configPath}`);
        const fileContent = await fs.readFile(configPath, 'utf-8');
        
        if (configPath.endsWith('.json')) {
          configData = JSON.parse(fileContent);
        } else if (configPath.endsWith('.js') || configPath.endsWith('.ts')) {
          // Dynamic import for JS/TS config files
          const configModule = await import(path.resolve(configPath));
          configData = configModule.default || configModule;
        }
      }

      // Merge with environment variables
      const envConfig = this.buildConfigFromEnv();
      configData = { ...configData, ...envConfig };

      // Validate configuration
      this.config = AppConfigSchema.parse(configData);
      this.logger.info('Configuration loaded and validated successfully');
      
      return this.config;
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildConfigFromEnv(): Partial<AppConfig> {
    return {
      git: {
        repositoryUrl: process.env.GIT_REPOSITORY_URL || '',
        branch: process.env.GIT_BRANCH || 'main',
        username: process.env.GIT_USERNAME,
        token: process.env.GIT_TOKEN,
        modelsPath: process.env.MODELS_DIRECTORY || 'models',
        outputPath: process.env.OUTPUT_DIRECTORY || 'output'
      },
      confluence: {
        baseUrl: process.env.CONFLUENCE_BASE_URL || '',
        username: process.env.CONFLUENCE_USERNAME || '',
        apiToken: process.env.CONFLUENCE_API_TOKEN || '',
        spaceKey: process.env.CONFLUENCE_SPACE_KEY || ''
      },
      diagram: {
        format: (process.env.DEFAULT_DIAGRAM_FORMAT as 'mermaid' | 'plantuml') || 'mermaid',
        direction: 'TB',
        showAttributes: true,
        showMethods: false,
        showRelationships: true,
        includeMetadata: true
      },
      sivi: {
        baseUrl: process.env.SIVI_AFD_BASE_URL || 'https://www.sivi.org/afd',
        version: process.env.SIVI_AFD_VERSION || '2.0'
      },
      output: {
        directory: process.env.OUTPUT_DIRECTORY || './output',
        modelsDirectory: process.env.MODELS_DIRECTORY || './models'
      },
      logging: {
        level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
        file: process.env.LOG_FILE
      }
    };
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  async saveConfig(config: AppConfig, filePath: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
      this.logger.info(`Configuration saved to ${filePath}`);
    } catch (error) {
      this.logger.error('Failed to save configuration', error);
      throw error;
    }
  }
}
