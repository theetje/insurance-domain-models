import fs from 'fs-extra';
import path from 'path';
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
      let configData: any = {};

      // If no config path provided, try default locations
      if (!configPath) {
        const defaultPaths = [
          '.model-creator.json',
          'config.json'
        ];
        
        for (const defaultPath of defaultPaths) {
          if (await fs.pathExists(defaultPath)) {
            configPath = defaultPath;
            break;
          }
        }
      }

      // Try to load from file if path found
      if (configPath && await fs.pathExists(configPath)) {
        this.logger.info(`Loading configuration from ${configPath}`);
        const fileContent = await fs.readFile(configPath, 'utf-8');
        
        if (configPath.endsWith('.json')) {
          configData = JSON.parse(fileContent);
        } else {
          throw new Error('Only JSON configuration files are supported');
        }
      } else {
        throw new Error('No configuration file found. Please create .model-creator.json');
      }

      // Validate configuration
      this.config = AppConfigSchema.parse(configData);
      this.logger.info('Configuration loaded and validated successfully');
      
      return this.config;
    } catch (error) {
      this.logger.error('Failed to load configuration', error);
      throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
