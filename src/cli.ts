#!/usr/bin/env node

import { Command } from 'commander';
import { ModelCreator } from './model-creator';
import { Logger } from './utils/logger';
import { CLIOptions } from './types';
import fs from 'fs-extra';
import path from 'path';

const program = new Command();

// Helper function to get logger based on global options
function getLogger(): Logger {
  const globalOptions = program.opts();
  const level = globalOptions.verbose ? 'info' : 'warn';
  
  // Set global log level to affect all services
  Logger.setGlobalLevel(level);
  
  return Logger.getInstance({
    level
  });
}

// Helper function to initialize ModelCreator with proper log level
async function initializeModelCreator(): Promise<ModelCreator> {
  const modelCreator = new ModelCreator();
  const logLevel = program.opts().verbose ? 'info' : 'warn';
  await modelCreator.initialize(program.opts().config, logLevel);
  return modelCreator;
}

program
  .name('model-creator')
  .description('Comprehensive tool for integrating Git-based UML domain models with Confluence using SIVI AFD 2.0')
  .version('1.0.0');

// Global options
program
  .option('-c, --config <path>', 'path to configuration file')
  .option('-v, --verbose', 'enable verbose logging (shows info messages, errors and warnings always shown)')
  .option('--dry-run', 'show what would be done without executing');

// Initialize command
program
  .command('init')
  .description('Initialize a new model repository')
  .option('-n, --name <name>', 'repository name')
  .option('-d, --description <description>', 'repository description')
  .action(async (options) => {
    try {
      // Initialize logger with verbose setting
      const logger = getLogger();
      
      const modelCreator = await initializeModelCreator();

      logger.info('Initializing new model repository...');

      // Create initial domain model
      const name = options.name || 'Insurance Domain Model';
      const description = options.description || 'SIVI AFD 2.0 compliant insurance domain model';
      
      const result = await modelCreator.createCompleteWorkflow(name, description);

      getLogger().info('Repository initialized successfully!');
      getLogger().info(`Model: ${result.model.name}`);
      getLogger().info(`Entities: ${result.model.entities.length}`);
      
      if (result.confluencePageId) {
        getLogger().info(`Confluence Page ID: ${result.confluencePageId}`);
      }

    } catch (error) {
      getLogger().error('Failed to initialize repository', error);
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

      getLogger().info(`Creating domain model: ${name}`);

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
        getLogger().info(`Diagram saved to: ${diagramPath}`);
      }

      getLogger().info('Domain model created successfully!');
      console.log(JSON.stringify(result.model, null, 2));

    } catch (error) {
      getLogger().error('Failed to create domain model', error);
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

      getLogger().info(`Generating diagram from: ${modelFile}`);

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
        getLogger().info(`Diagram saved to: ${outputPath}`);
      } else {
        console.log(diagram);
      }

    } catch (error) {
      getLogger().error('Failed to generate diagram', error);
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

      getLogger().info('Syncing models with Git and Confluence...');

      // Get list of models
      const models = await modelCreator.listDomainModels();
      
      if (models.length === 0) {
        getLogger().info('No models found to sync');
        return;
      }

      // Process each model
      for (const modelFile of models) {
        getLogger().info(`Processing model: ${modelFile}`);
        
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

      getLogger().info('Sync completed successfully!');

    } catch (error) {
      getLogger().error('Failed to sync models', error);
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

      getLogger().info('Checking integration status...');
      
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
      getLogger().error('Failed to get status', error);
      process.exit(1);
    }
  });

// List models command
program
  .command('list')
  .description('List all domain models')
  .action(async () => {
    // Set logging level first
    getLogger();
    
    try {
      const modelCreator = await initializeModelCreator();

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
      getLogger().error('Failed to list models', error);
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
          getLogger().warn('Configuration file already exists');
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
        getLogger().info(`Configuration file created: ${configPath}`);
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
      getLogger().error('Failed to manage configuration', error);
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

      getLogger().info(`Importing domain model from: ${inputFile}`);

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
        getLogger().info(`Diagram saved to: ${diagramPath}`);
      }

      // Sync with Confluence if configured (using complete workflow approach)
      if (modelCreator.getConfig().confluence && modelCreator.getConfig().confluence.baseUrl) {
        try {
          // Use the complete workflow method which handles Confluence sync
          getLogger().info('Syncing with Confluence...');
          // The syncWithConfluence will be handled if both Git and Confluence are configured
        } catch (error) {
          getLogger().warn('Failed to sync with Confluence', error);
        }
      }

      getLogger().info('Domain model imported successfully!');
      console.log(JSON.stringify(model, null, 2));

    } catch (error) {
      getLogger().error('Failed to import domain model', error);
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
      
      getLogger().info(`Removing domain model: ${modelFile}`);

      // Check if model exists
      const models = await modelCreator.listDomainModels();
      if (!models.includes(modelFile)) {
        getLogger().error(`Model not found: ${modelFile}`);
        console.log('Available models:');
        models.forEach((model: string) => console.log(`  - ${model}`));
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
          getLogger().info('Removal cancelled');
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
        getLogger().info(`Removed model: ${modelPath}`);
      }

      if (await fs.pathExists(diagramPath)) {
        await fs.remove(diagramPath);
        getLogger().info(`Removed diagram: ${diagramPath}`);
      }

      // Commit changes if Git is configured
      if (modelCreator.getConfig().git && modelCreator.getConfig().git.repositoryUrl) {
        try {
          await modelCreator.commitAndPushChanges(`Remove ${modelFile} and related files`);
          getLogger().info('Changes committed and pushed to Git');
        } catch (error) {
          getLogger().warn('Failed to commit changes to Git', error);
        }
      }

      getLogger().info(`Domain model ${modelFile} removed successfully`);

    } catch (error) {
      getLogger().error('Failed to remove domain model', error);
      process.exit(1);
    }
  });

// Debug confluence command
program
  .command('debug-confluence')
  .description('Debug Confluence integration and check available macros')
  .action(async () => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      getLogger().info('Testing Confluence connection and checking macros...');
      
      // Test connection
      const isConnected = await modelCreator.testConfluenceConnection();
      if (!isConnected) {
        getLogger().error('❌ Confluence connection failed');
        process.exit(1);
      }
      
      getLogger().info('✅ Confluence connection successful');
      
      // Fetch available macros
      const macros = await modelCreator.getConfluenceMacros();
      getLogger().info(`📋 Available macros (${macros.length}): ${macros.join(', ')}`);
      
      // Check specifically for Mermaid-related macros
      const mermaidMacros = macros.filter((macro: string) => 
        macro.toLowerCase().includes('mermaid') || 
        macro.toLowerCase().includes('diagram')
      );
      
      if (mermaidMacros.length > 0) {
        getLogger().info(`🎯 Mermaid-related macros found: ${mermaidMacros.join(', ')}`);
      } else {
        getLogger().warn('⚠️  No Mermaid-related macros detected');
        getLogger().info('💡 Make sure "Mermaid Diagrams for Confluence" app is installed');
      }
      
    } catch (error) {
      getLogger().error('Debug failed', error);
      process.exit(1);
    }
  });

// Generate SVG command
program
  .command('generate-svg')
  .description('Generate SVG diagram from model input file')
  .argument('<input-file>', 'path to JSON model input file')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('-o, --output <path>', 'output directory (default: ./svg-output)')
  .option('-w, --width <width>', 'SVG width in pixels', '1400')
  .option('-h, --height <height>', 'SVG height in pixels', '1000')
  .option('--svg-only', 'generate only SVG, skip Git and Confluence sync')
  .action(async (inputFile, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const inputPath = path.resolve(inputFile);
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      getLogger().info(`Generating SVG from: ${inputFile}`);

      // Load and parse the input file
      const inputContent = await fs.readFile(inputPath, 'utf-8');
      const modelData = JSON.parse(inputContent);

      // Set up output directory
      const outputDir = path.resolve(options.output || './svg-output');
      await fs.ensureDir(outputDir);

      const baseName = modelData.name ? modelData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 'model';
      
      getLogger().info(`Processing model: ${modelData.name || 'Unnamed Model'}`);

      // Create the domain model from the input data
      const model = await modelCreator.importDomainModel(modelData);

      // Generate diagram code
      const diagram = await modelCreator.generateDiagram(model, options.format as 'mermaid' | 'plantuml');

      // Create output directory for this model
      const modelOutputDir = path.join(outputDir, baseName);
      await fs.ensureDir(modelOutputDir);

      // Generate SVG
      const svgPath = path.join(modelOutputDir, `${baseName}-diagram.svg`);
      const DiagramImageService = require('./services/diagram-image.service').DiagramImageService;
      const imageService = new DiagramImageService();
      
      if (options.format === 'mermaid') {
        await imageService.generateMermaidImage(diagram, svgPath, 'svg', parseInt(options.width), parseInt(options.height));
      } else {
        await imageService.generatePlantUMLImage(diagram, svgPath, 'svg');
      }

      let gitPaths = { modelPath: '', diagramPath: '' };
      let confluencePageId = '';

      if (!options.svgOnly) {
        // Save to Git
        const modelPath = await modelCreator.saveDomainModelToGit(model, `${baseName}.model.json`);
        const diagramPath = await modelCreator.saveDiagramToGit(
          diagram,
          `${baseName}-diagram`,
          options.format as 'mermaid' | 'plantuml'
        );

        gitPaths = { modelPath, diagramPath };

        // Commit changes
        await modelCreator.commitAndPushChanges(`Add ${model.name} model and SVG diagram`);

        // Sync with Confluence
        if (modelCreator.getConfig().confluence && modelCreator.getConfig().confluence.baseUrl) {
          try {
            getLogger().info('Syncing with Confluence...');
            confluencePageId = await modelCreator.syncWithConfluence(
              model,
              diagram,
              options.format as 'mermaid' | 'plantuml',
              {
                modelUrl: gitPaths.modelPath,
                diagramUrl: gitPaths.diagramPath
              }
            );
          } catch (error) {
            getLogger().warn('Failed to sync with Confluence', error);
          }
        }
      }

      // Create processing summary
      const summary = {
        modelName: model.name,
        inputFile: inputPath,
        svgPath,
        format: options.format,
        width: parseInt(options.width),
        height: parseInt(options.height),
        timestamp: new Date().toISOString(),
        gitPaths: options.svgOnly ? null : gitPaths,
        confluencePageId: options.svgOnly ? null : confluencePageId
      };

      const summaryPath = path.join(modelOutputDir, `${baseName}-summary.json`);
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

      getLogger().info('SVG generation completed successfully!');
      console.log('\n=== Generation Summary ===');
      console.log(`Model: ${model.name}`);
      console.log(`SVG Path: ${svgPath}`);
      console.log(`Format: ${options.format}`);
      console.log(`Dimensions: ${options.width}x${options.height}`);
      if (!options.svgOnly) {
        console.log(`Git Model: ${gitPaths.modelPath}`);
        console.log(`Git Diagram: ${gitPaths.diagramPath}`);
        if (confluencePageId) {
          console.log(`Confluence Page ID: ${confluencePageId}`);
        }
      }
      console.log(`Summary: ${summaryPath}`);

    } catch (error) {
      getLogger().error('Failed to generate SVG diagram', error);
      process.exit(1);
    }
  });

// Process input models command
program
  .command('process-inputs')
  .description('Process all input models and generate complete workflow')
  .option('-i, --input-dir <path>', 'directory containing input model files', './inputs')
  .option('-o, --output-dir <path>', 'base output directory', './output')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('--svg-only', 'generate SVG only, skip Git and Confluence')
  .option('--dry-run', 'show what would be done without executing')
  .action(async (options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const inputDir = path.resolve(options.inputDir);
      const outputDir = path.resolve(options.outputDir);

      if (!await fs.pathExists(inputDir)) {
        throw new Error(`Input directory not found: ${inputDir}`);
      }

      getLogger().info(`Processing input models from: ${inputDir}`);

      // Find all JSON files in input directory
      const inputFiles = await fs.readdir(inputDir);
      const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        getLogger().warn('No JSON input files found in input directory');
        return;
      }

      getLogger().info(`Found ${jsonFiles.length} input model files`);

      const results = [];

      for (const jsonFile of jsonFiles) {
        const inputPath = path.join(inputDir, jsonFile);
        const baseName = path.basename(jsonFile, '.json');
        
        try {
          getLogger().info(`\n📋 Processing: ${jsonFile}`);

          if (options.dryRun) {
            getLogger().info(`[DRY RUN] Would process: ${jsonFile}`);
            continue;
          }

          // Load and parse the input file
          const inputContent = await fs.readFile(inputPath, 'utf-8');
          const modelData = JSON.parse(inputContent);

          // Create model from input data
          const model = await modelCreator.importDomainModel(modelData);

          // Generate diagram
          const diagram = await modelCreator.generateDiagram(model, options.format as 'mermaid' | 'plantuml');

          // Create output directory for this model
          const modelOutputDir = path.join(outputDir, baseName);
          await fs.ensureDir(modelOutputDir);

          // Generate SVG
          const svgPath = path.join(modelOutputDir, `${baseName}-diagram.svg`);
          const DiagramImageService = require('./services/diagram-image.service').DiagramImageService;
          const imageService = new DiagramImageService();
          
          if (options.format === 'mermaid') {
            await imageService.generateMermaidImage(diagram, svgPath, 'svg', 1400, 1000);
          } else {
            await imageService.generatePlantUMLImage(diagram, svgPath, 'svg');
          }

          let gitPaths = { modelPath: '', diagramPath: '' };
          let confluencePageId = '';

          if (!options.svgOnly) {
            // Save to Git
            const modelPath = await modelCreator.saveDomainModelToGit(model, `${baseName}.model.json`);
            const diagramPath = await modelCreator.saveDiagramToGit(
              diagram,
              `${baseName}-diagram`,
              options.format as 'mermaid' | 'plantuml'
            );

            gitPaths = { modelPath, diagramPath };

            // Commit changes
            await modelCreator.commitAndPushChanges(`Add ${model.name} domain model and diagram`);

            // Sync with Confluence
            const gitFileUrls = {
              modelUrl: modelCreator.getConfig().git.repositoryUrl ? 
                `${modelCreator.getConfig().git.repositoryUrl}/blob/main/${modelPath}` : '',
              diagramUrl: modelCreator.getConfig().git.repositoryUrl ? 
                `${modelCreator.getConfig().git.repositoryUrl}/blob/main/${diagramPath}` : ''
            };

            confluencePageId = await modelCreator.syncWithConfluence(
              model,
              diagram,
              options.format as 'mermaid' | 'plantuml',
              gitFileUrls
            );
          }

          const result = {
            inputFile: jsonFile,
            modelName: model.name,
            svgPath,
            gitPaths,
            confluencePageId,
            status: 'success'
          };

          results.push(result);
          getLogger().info(`✅ Processed successfully: ${jsonFile}`);

        } catch (error) {
          getLogger().error(`❌ Failed to process ${jsonFile}`, error);
          results.push({
            inputFile: jsonFile,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Generate summary report
      const summaryPath = path.join(outputDir, 'processing-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        inputDirectory: inputDir,
        outputDirectory: outputDir,
        totalFiles: jsonFiles.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        results
      }, null, 2));

      getLogger().info(`\n📊 Processing Summary:`);
      getLogger().info(`Total files: ${jsonFiles.length}`);
      getLogger().info(`Successful: ${results.filter(r => r.status === 'success').length}`);
      getLogger().info(`Failed: ${results.filter(r => r.status === 'failed').length}`);
      getLogger().info(`Summary saved to: ${summaryPath}`);

    } catch (error) {
      getLogger().error('Failed to process input models', error);
      process.exit(1);
    }
  });

// Input models status command
program
  .command('input-status')
  .description('Show status of all input models and their outputs')
  .option('-i, --input-dir <path>', 'directory containing input model files', './inputs')
  .option('-o, --output-dir <path>', 'base output directory', './output')
  .action(async (options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const inputDir = path.resolve(options.inputDir);
      const outputDir = path.resolve(options.outputDir);

      getLogger().info('Checking input models status...');

      if (!await fs.pathExists(inputDir)) {
        console.log(`❌ Input directory not found: ${inputDir}`);
        return;
      }

      // Find all JSON files in input directory
      const inputFiles = await fs.readdir(inputDir);
      const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        console.log('No JSON input files found in input directory');
        return;
      }

      console.log('\n=== Input Models Status ===\n');

      for (const jsonFile of jsonFiles) {
        const inputPath = path.join(inputDir, jsonFile);
        const baseName = path.basename(jsonFile, '.json');
        const modelOutputDir = path.join(outputDir, baseName);

        try {
          // Load input model
          const inputContent = await fs.readFile(inputPath, 'utf-8');
          const modelData = JSON.parse(inputContent);

          console.log(`📋 ${modelData.name}`);
          console.log(`   Input File: ${jsonFile}`);
          console.log(`   Version: ${modelData.version}`);
          console.log(`   Entities: ${modelData.entities.length}`);

          // Check for SVG output
          const svgPath = path.join(modelOutputDir, `${baseName}-diagram.svg`);
          const hasSvg = await fs.pathExists(svgPath);
          console.log(`   SVG Diagram: ${hasSvg ? '✅' : '❌'} ${hasSvg ? svgPath : 'Not generated'}`);

          // Check for Git model file
          const gitModelPath = path.join(process.cwd(), 'models', `${baseName}.model.json`);
          const hasGitModel = await fs.pathExists(gitModelPath);
          console.log(`   Git Model: ${hasGitModel ? '✅' : '❌'} ${hasGitModel ? gitModelPath : 'Not saved'}`);

          // Check for Git diagram file
          const gitDiagramPath = path.join(process.cwd(), 'diagrams', `${baseName}-diagram.mmd`);
          const hasGitDiagram = await fs.pathExists(gitDiagramPath);
          console.log(`   Git Diagram: ${hasGitDiagram ? '✅' : '❌'} ${hasGitDiagram ? gitDiagramPath : 'Not saved'}`);

          // Check processing summary
          const summaryPath = path.join(outputDir, 'processing-summary.json');
          if (await fs.pathExists(summaryPath)) {
            const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
            const result = summary.results.find((r: any) => r.inputFile === jsonFile);
            if (result) {
              console.log(`   Confluence Page: ${result.confluencePageId ? '✅ ' + result.confluencePageId : '❌ Not synced'}`);
              console.log(`   Last Processed: ${summary.timestamp}`);
            }
          }

          console.log('');

        } catch (error) {
          console.log(`❌ Failed to check status for ${jsonFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.log('');
        }
      }

    } catch (error) {
      getLogger().error('Failed to get input models status', error);
      process.exit(1);
    }
  });

// Initialize inputs command
program
  .command('init-inputs')
  .description('Initialize directory structure for input model management')
  .option('-b, --base-dir <path>', 'base directory for initialization', './')
  .action(async (options) => {
    try {
      const baseDir = path.resolve(options.baseDir);
      
      getLogger().info('Initializing input model management structure...');

      // Create directory structure
      const directories = [
        'inputs',
        'output',
        'output/svg',
        'output/png',
        'output/reports'
      ];

      for (const dir of directories) {
        const dirPath = path.join(baseDir, dir);
        await fs.ensureDir(dirPath);
        getLogger().info(`Created directory: ${dirPath}`);
      }

      // Create example input file
      const exampleInputPath = path.join(baseDir, 'inputs', 'example-model.json');
      if (!await fs.pathExists(exampleInputPath)) {
        const exampleModel = {
          name: "Example Insurance Model",
          version: "1.0.0",
          description: "Example SIVI AFD 2.0 compliant insurance model",
          namespace: "nl.sivi.afd.example",
          entities: [
            {
              id: "policy",
              name: "Policy",
              description: "Insurance policy entity",
              type: "Policy",
              attributes: [
                {
                  name: "contractNumber",
                  type: "string",
                  required: true,
                  description: "Unique policy contract number",
                  siviReference: "AFD.Policy.ContractNumber"
                }
              ],
              relationships: [],
              siviReference: "AFD.Policy",
              version: "2.0"
            }
          ]
        };
        
        await fs.writeFile(exampleInputPath, JSON.stringify(exampleModel, null, 2));
        getLogger().info(`Created example input file: ${exampleInputPath}`);
      }

      // Create README for inputs
      const readmePath = path.join(baseDir, 'inputs', 'README.md');
      const readmeContent = `# Input Models Directory

This directory contains JSON files that define domain models for processing.

## Structure

- \`*.json\` - Domain model input files
- Each file should follow the SIVI AFD 2.0 model structure

## Usage

1. Place your domain model JSON files in this directory
2. Run \`model-creator process-inputs\` to generate SVG diagrams and sync with Git/Confluence
3. Use \`model-creator input-status\` to check the status of all input models
4. Use \`model-creator generate-svg <input-file>\` to generate SVG for a specific model

## Example Commands

\`\`\`bash
# Generate SVG for a specific model
model-creator generate-svg inputs/my-model.json -o output/svg

# Process all input models
model-creator process-inputs

# Check status of all input models
model-creator input-status

# Generate SVG only (skip Git and Confluence)
model-creator process-inputs --svg-only
\`\`\`

## File Format

Each JSON file should contain a domain model with the following structure:

\`\`\`json
{
  "name": "Model Name",
  "version": "1.0.0",
  "description": "Model description",
  "namespace": "nl.sivi.afd.namespace",
  "entities": [
    {
      "id": "entity-id",
      "name": "Entity Name",
      "description": "Entity description",
      "type": "Policy|Coverage|Party|Claim|Premium|Object|Clause",
      "attributes": [...],
      "relationships": [...],
      "siviReference": "AFD.Entity",
      "version": "2.0"
    }
  ]
}
\`\`\`
`;

      await fs.writeFile(readmePath, readmeContent);
      getLogger().info(`Created README: ${readmePath}`);

      getLogger().info('✅ Input model management structure initialized successfully!');
      
      console.log('\n📁 Directory Structure Created:');
      console.log('├── inputs/           - Place your input model JSON files here');
      console.log('│   ├── example-model.json - Example input file');
      console.log('│   └── README.md     - Documentation');
      console.log('├── output/           - Generated outputs');
      console.log('│   ├── svg/          - SVG diagram files');
      console.log('│   ├── png/          - PNG diagram files');
      console.log('│   └── reports/      - Processing reports');
      console.log('');
      console.log('🚀 Next Steps:');
      console.log('1. Place your domain model JSON files in the inputs/ directory');
      console.log('2. Run: model-creator process-inputs');
      console.log('3. Check status: model-creator input-status');

    } catch (error) {
      getLogger().error('Failed to initialize input model structure', error);
      process.exit(1);
    }
  });

// List SVG generation results command
program
  .command('list-svg')
  .description('List all generated SVG outputs and their status')
  .option('-d, --directory <path>', 'SVG output directory to scan', './svg-output')
  .action(async (options) => {
    try {
      const outputDir = path.resolve(options.directory);
      
      if (!await fs.pathExists(outputDir)) {
        console.log('No SVG output directory found');
        return;
      }

      getLogger().info(`Scanning SVG outputs in: ${outputDir}`);

      const modelDirs = await fs.readdir(outputDir);
      
      if (modelDirs.length === 0) {
        console.log('No SVG outputs found');
        return;
      }

      console.log('\n=== SVG Generation Results ===\n');

      for (const modelDir of modelDirs) {
        const modelPath = path.join(outputDir, modelDir);
        const stat = await fs.stat(modelPath);
        
        if (stat.isDirectory()) {
          try {
            const summaryPath = path.join(modelPath, `${modelDir}-summary.json`);
            const svgPath = path.join(modelPath, `${modelDir}-diagram.svg`);
            
            if (await fs.pathExists(summaryPath) && await fs.pathExists(svgPath)) {
              const summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
              const svgStat = await fs.stat(svgPath);
              
              console.log(`📊 ${summary.modelName}`);
              console.log(`   Format: ${summary.format}`);
              console.log(`   Dimensions: ${summary.width}x${summary.height}`);
              console.log(`   Generated: ${new Date(summary.timestamp).toLocaleString()}`);
              console.log(`   SVG Size: ${(svgStat.size / 1024).toFixed(1)} KB`);
              console.log(`   SVG Path: ${svgPath}`);
              if (summary.gitPaths) {
                console.log(`   Git Model: ${summary.gitPaths.modelPath}`);
                console.log(`   Git Diagram: ${summary.gitPaths.diagramPath}`);
              }
              if (summary.confluencePageId) {
                console.log(`   Confluence: Page ${summary.confluencePageId}`);
              }
              console.log('');
            } else {
              console.log(`❌ ${modelDir} (incomplete - missing files)`);
            }
          } catch (error) {
            console.log(`❌ ${modelDir} (failed to read summary)`);
          }
        }
      }

    } catch (error) {
      getLogger().error('Failed to list SVG outputs', error);
      process.exit(1);
    }
  });

// Create model directories command
program
  .command('init-workspace')
  .description('Initialize workspace with proper directory structure')
  .option('-i, --inputs <path>', 'Input models directory', './model-inputs')
  .option('-o, --outputs <path>', 'SVG outputs directory', './svg-outputs')
  .action(async (options) => {
    try {
      const inputsDir = path.resolve(options.inputs);
      const outputsDir = path.resolve(options.outputs);

      getLogger().info('Creating workspace directories...');

      // Create directories
      await fs.ensureDir(inputsDir);
      await fs.ensureDir(outputsDir);
      await fs.ensureDir('./temp');

      // Create sample input file if inputs directory is empty
      const inputFiles = await fs.readdir(inputsDir);
      if (inputFiles.length === 0) {
        const sampleModel = {
          name: "Example Insurance Model",
          version: "1.0.0",
          description: "Sample SIVI AFD 2.0 insurance model",
          namespace: "nl.sivi.afd.insurance",
          entities: [
            {
              id: "policy",
              name: "Policy",
              description: "Insurance policy/contract entity",
              type: "Policy",
              attributes: [
                {
                  name: "contractNumber",
                  type: "string",
                  required: true,
                  description: "Unique policy contract number",
                  siviReference: "AFD.Policy.ContractNumber"
                }
              ],
              relationships: [],
              siviReference: "AFD.Policy",
              version: "2.0"
            }
          ]
        };

        const samplePath = path.join(inputsDir, 'example-model.json');
        await fs.writeFile(samplePath, JSON.stringify(sampleModel, null, 2));
        getLogger().info(`Sample model created: ${samplePath}`);
      }

      // Create README in inputs directory
      const readmeContent = `# Model Inputs

This directory contains JSON model input files for the SIVI AFD 2.0 Model Creator.

## File Format

Each JSON file should contain a complete domain model with the following structure:

\`\`\`json
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
\`\`\`

## Usage

1. Create or edit JSON model input files in this directory
2. Run \`model-creator generate-svg <filename>\` to generate SVG diagrams
3. Use \`model-creator list-svg\` to see all generated outputs

## Examples

- \`example-model.json\` - Basic sample model
- Add your own model files here
`;

      const readmePath = path.join(inputsDir, 'README.md');
      await fs.writeFile(readmePath, readmeContent);

      console.log('\n=== Workspace Initialized ===');
      console.log(`Input models directory: ${inputsDir}`);
      console.log(`SVG outputs directory: ${outputsDir}`);
      console.log(`Temp directory: ./temp`);
      console.log('\nNext steps:');
      console.log(`1. Add model JSON files to: ${inputsDir}`);
      console.log(`2. Generate SVGs: model-creator generate-svg <model-file.json>`);
      console.log(`3. List results: model-creator list-svg`);

    } catch (error) {
      getLogger().error('Failed to initialize workspace', error);
      process.exit(1);
    }
  });

// Set up global error handler
process.on('unhandledRejection', (reason, promise) => {
  getLogger().error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  getLogger().error('Uncaught Exception:', error);
  process.exit(1);
});

// Parse command line arguments
program.parse();

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
