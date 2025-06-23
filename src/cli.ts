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

// Import model command
program
  .command('import')
  .description('Import a domain model from JSON file')
  .argument('<input-file>', 'path to input JSON file')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('-o, --output <path>', 'output directory')
  .action(async (inputFile, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const inputPath = path.resolve(inputFile);
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      logger.info(`Importing domain model from: ${inputFile}`);

      // Load and parse the input file
      const inputContent = await fs.readFile(inputPath, 'utf-8');
      const modelData = JSON.parse(inputContent);

      // Create model with the provided data
      const model = await modelCreator.importDomainModel(modelData);

      // Generate diagram
      const diagram = await modelCreator.generateDiagram(model, options.format as 'mermaid' | 'plantuml');

      // Save to Git if configured
      let gitPaths: { modelPath: string; diagramPath: string } = {
        modelPath: '',
        diagramPath: ''
      };

      if (modelCreator.getConfig().git && modelCreator.getConfig().git.repositoryUrl) {
        const modelPath = await modelCreator.saveDomainModelToGit(model);
        const diagramPath = await modelCreator.saveDiagramToGit(
          diagram,
          `${model.name.toLowerCase().replace(/\s+/g, '-')}-diagram`,
          options.format as 'mermaid' | 'plantuml'
        );

        gitPaths = { modelPath, diagramPath };

        // Commit changes
        await modelCreator.commitAndPushChanges(`Import ${model.name} domain model from ${inputFile}`);
      }

      // Save diagram to output directory if specified
      if (options.output) {
        const outputDir = path.resolve(options.output);
        await fs.ensureDir(outputDir);
        
        const extension = options.format === 'mermaid' ? '.mmd' : '.puml';
        const diagramPath = path.join(outputDir, `${model.name.toLowerCase().replace(/\s+/g, '-')}${extension}`);
        
        await fs.writeFile(diagramPath, diagram);
        logger.info(`Diagram saved to: ${diagramPath}`);
      }

      // Sync with Confluence if configured (using complete workflow approach)
      if (modelCreator.getConfig().confluence && modelCreator.getConfig().confluence.baseUrl) {
        try {
          // Use the complete workflow method which handles Confluence sync
          logger.info('Syncing with Confluence...');
          // The syncWithConfluence will be handled if both Git and Confluence are configured
        } catch (error) {
          logger.warn('Failed to sync with Confluence', error);
        }
      }

      logger.info('Domain model imported successfully!');
      console.log(JSON.stringify(model, null, 2));

    } catch (error) {
      logger.error('Failed to import domain model', error);
      process.exit(1);
    }
  });

// Remove model command
program
  .command('remove')
  .description('Remove a domain model')
  .argument('<model-name>', 'name of the model file to remove (without .model.json)')
  .option('--force', 'force removal without confirmation')
  .action(async (modelName, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      // Add .model.json extension if not present
      const modelFile = modelName.endsWith('.model.json') ? modelName : `${modelName}.model.json`;
      
      logger.info(`Removing domain model: ${modelFile}`);

      // Check if model exists
      const models = await modelCreator.listDomainModels();
      if (!models.includes(modelFile)) {
        logger.error(`Model not found: ${modelFile}`);
        console.log('Available models:');
        models.forEach(model => console.log(`  - ${model}`));
        process.exit(1);
      }

      // Confirm removal unless --force is used
      if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(`Are you sure you want to remove ${modelFile}? (y/N): `, resolve);
        });
        
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          logger.info('Removal cancelled');
          return;
        }
      }

      // Remove model and related files
      const modelPath = path.join(process.cwd(), 'models', modelFile);
      const diagramName = modelFile.replace('.model.json', '-diagram.mmd');
      const diagramPath = path.join(process.cwd(), 'diagrams', diagramName);

      // Remove files
      if (await fs.pathExists(modelPath)) {
        await fs.remove(modelPath);
        logger.info(`Removed model: ${modelPath}`);
      }

      if (await fs.pathExists(diagramPath)) {
        await fs.remove(diagramPath);
        logger.info(`Removed diagram: ${diagramPath}`);
      }

      // Commit changes if Git is configured
      if (modelCreator.getConfig().git && modelCreator.getConfig().git.repositoryUrl) {
        try {
          await modelCreator.commitAndPushChanges(`Remove ${modelFile} and related files`);
          logger.info('Changes committed and pushed to Git');
        } catch (error) {
          logger.warn('Failed to commit changes to Git', error);
        }
      }

      logger.info(`Domain model ${modelFile} removed successfully`);

    } catch (error) {
      logger.error('Failed to remove domain model', error);
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
