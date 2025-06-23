#!/usr/bin/env node

import { Command } from 'commander';
import { ModelCreator } from './model-creator';
import { Logger } from './utils/logger';
import { CLIOptions } from './types';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();
const logger = Logger.getInstance();

program
  .name('model-creator')
  .description('Comprehensive tool for integrating Git-based UML domain models with Confluence using SIVI AFD 2.0')
  .version('1.0.0');

// Global options
program
  .option('-c, --config <path>', 'path to configuration file')
  .option('-v, --verbose', 'enable verbose logging')
  .option('--dry-run', 'show what would be done without executing');

// Initialize command
program
  .command('init')
  .description('Initialize a new model repository')
  .option('-n, --name <name>', 'repository name')
  .option('-d, --description <description>', 'repository description')
  .action(async (options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info('Initializing new model repository...');

      // Create initial domain model
      const name = options.name || 'Insurance Domain Model';
      const description = options.description || 'SIVI AFD 2.0 compliant insurance domain model';
      
      const result = await modelCreator.createCompleteWorkflow(name, description);

      logger.info('Repository initialized successfully!');
      logger.info(`Model: ${result.model.name}`);
      logger.info(`Entities: ${result.model.entities.length}`);
      
      if (result.confluencePageId) {
        logger.info(`Confluence Page ID: ${result.confluencePageId}`);
      }

    } catch (error) {
      logger.error('Failed to initialize repository', error);
      process.exit(1);
    }
  });

// Create model command
program
  .command('create')
  .description('Create a new domain model')
  .argument('<name>', 'model name')
  .option('-d, --description <description>', 'model description')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('-o, --output <path>', 'output directory')
  .action(async (name, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info(`Creating domain model: ${name}`);

      const result = await modelCreator.createCompleteWorkflow(
        name,
        options.description,
        options.format as 'mermaid' | 'plantuml'
      );

      // Save diagram to output directory if specified
      if (options.output) {
        const outputDir = path.resolve(options.output);
        await fs.ensureDir(outputDir);
        
        const extension = options.format === 'mermaid' ? '.mmd' : '.puml';
        const diagramPath = path.join(outputDir, `${name.toLowerCase().replace(/\s+/g, '-')}${extension}`);
        
        await fs.writeFile(diagramPath, result.diagram);
        logger.info(`Diagram saved to: ${diagramPath}`);
      }

      logger.info('Domain model created successfully!');
      console.log(JSON.stringify(result.model, null, 2));

    } catch (error) {
      logger.error('Failed to create domain model', error);
      process.exit(1);
    }
  });

// Generate diagram command
program
  .command('diagram')
  .description('Generate UML diagram from existing model')
  .argument('<model-file>', 'path to model file (.json)')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('-o, --output <path>', 'output file path')
  .option('--no-attributes', 'hide entity attributes')
  .option('--show-methods', 'show entity methods')
  .option('--no-relationships', 'hide relationships')
  .action(async (modelFile, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info(`Generating diagram from: ${modelFile}`);

      // Load model
      const modelPath = path.resolve(modelFile);
      if (!await fs.pathExists(modelPath)) {
        throw new Error(`Model file not found: ${modelPath}`);
      }

      const modelContent = await fs.readFile(modelPath, 'utf-8');
      const model = JSON.parse(modelContent);

      // Generate diagram
      const diagram = await modelCreator.generateDiagram(model, options.format, {
        showAttributes: options.attributes !== false,
        showMethods: options.showMethods || false,
        showRelationships: options.relationships !== false
      });

      // Output diagram
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, diagram);
        logger.info(`Diagram saved to: ${outputPath}`);
      } else {
        console.log(diagram);
      }

    } catch (error) {
      logger.error('Failed to generate diagram', error);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync models with Git and Confluence')
  .option('-m, --message <message>', 'commit message', 'Update domain models')
  .action(async (options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info('Syncing models with Git and Confluence...');

      // Get list of models
      const models = await modelCreator.listDomainModels();
      
      if (models.length === 0) {
        logger.info('No models found to sync');
        return;
      }

      // Process each model
      for (const modelFile of models) {
        logger.info(`Processing model: ${modelFile}`);
        
        const model = await modelCreator.loadDomainModelFromGit(modelFile);
        const diagram = await modelCreator.generateDiagram(model);
        
        // Save diagram to Git
        await modelCreator.saveDiagramToGit(
          diagram,
          `${model.name.toLowerCase().replace(/\s+/g, '-')}-diagram`,
          'mermaid'
        );
      }

      // Commit changes
      await modelCreator.commitAndPushChanges(options.message);

      logger.info('Sync completed successfully!');

    } catch (error) {
      logger.error('Failed to sync models', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show integration status')
  .action(async () => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info('Checking integration status...');
      
      const status = await modelCreator.getIntegrationStatus();

      console.log('\n=== Integration Status ===\n');
      
      console.log('🔗 Git Integration:');
      console.log(`  Connected: ${status.git.connected ? '✅' : '❌'}`);
      console.log(`  Branch: ${status.git.branch}`);
      console.log(`  Last Commit: ${status.git.commitHash || 'None'}`);
      
      console.log('\n📄 Confluence Integration:');
      console.log(`  Connected: ${status.confluence.connected ? '✅' : '❌'}`);
      console.log(`  Last Update: ${status.confluence.lastUpdate || 'Never'}`);
      
      console.log('\n📊 Models:');
      console.log(`  Count: ${status.models.count}`);
      console.log(`  Last Modified: ${status.models.lastModified || 'Unknown'}`);

    } catch (error) {
      logger.error('Failed to get status', error);
      process.exit(1);
    }
  });

// List models command
program
  .command('list')
  .description('List all domain models')
  .action(async () => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const models = await modelCreator.listDomainModels();

      if (models.length === 0) {
        console.log('No domain models found');
        return;
      }

      console.log('\n=== Domain Models ===\n');
      
      for (const modelFile of models) {
        try {
          const model = await modelCreator.loadDomainModelFromGit(modelFile);
          console.log(`📋 ${model.name}`);
          console.log(`   Version: ${model.version}`);
          console.log(`   Entities: ${model.entities.length}`);
          console.log(`   Updated: ${model.metadata.updated}`);
          console.log(`   File: ${modelFile}`);
          console.log('');
        } catch (error) {
          console.log(`❌ ${modelFile} (failed to load)`);
        }
      }

    } catch (error) {
      logger.error('Failed to list models', error);
      process.exit(1);
    }
  });

// Generate sequence diagram command
program
  .command('sequence')
  .description('Generate sequence diagram for insurance processes')
  .argument('<process>', 'process name (policy-creation|claim-processing)')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('-o, --output <path>', 'output file path')
  .action(async (processName, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info(`Generating sequence diagram for process: ${processName}`);

      const diagram = modelCreator.generateSequenceDiagram(
        processName as 'policy-creation' | 'claim-processing',
        options.format as 'mermaid' | 'plantuml'
      );

      // Output diagram
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, diagram);
        logger.info(`Sequence diagram saved to: ${outputPath}`);
      } else {
        console.log(diagram);
      }

    } catch (error) {
      logger.error('Failed to generate sequence diagram', error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration')
  .option('--show', 'show current configuration')
  .option('--init', 'create initial configuration file')
  .action(async (options) => {
    try {
      if (options.init) {
        const configPath = path.resolve('.model-creator.json');
        
        if (await fs.pathExists(configPath)) {
          logger.warn('Configuration file already exists');
          return;
        }

        const defaultConfig = {
          git: {
            repositoryUrl: '',
            branch: 'main',
            modelsPath: 'models',
            outputPath: 'output'
          },
          confluence: {
            baseUrl: '',
            username: '',
            apiToken: '',
            spaceKey: ''
          },
          diagram: {
            format: 'mermaid',
            direction: 'TB',
            showAttributes: true,
            showMethods: false,
            showRelationships: true,
            includeMetadata: true
          },
          sivi: {
            baseUrl: 'https://www.sivi.org/afd',
            version: '2.0'
          },
          output: {
            directory: './output',
            modelsDirectory: './models'
          },
          logging: {
            level: 'info'
          }
        };

        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.info(`Configuration file created: ${configPath}`);
        console.log('\nPlease edit the configuration file with your settings:');
        console.log('- Git repository URL and credentials');
        console.log('- Confluence URL and API token');
        console.log('- Other preferences');
      }

      if (options.show) {
        const modelCreator = new ModelCreator();
        await modelCreator.initialize(program.opts().config);
        
        const config = modelCreator.getConfig();
        console.log(JSON.stringify(config, null, 2));
      }

    } catch (error) {
      logger.error('Failed to manage configuration', error);
      process.exit(1);
    }
  });

// Set up global error handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
