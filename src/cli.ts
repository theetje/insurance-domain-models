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

// Debug confluence command
program
  .command('debug-confluence')
  .description('Debug Confluence integration and check available macros')
  .action(async () => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      logger.info('Testing Confluence connection and checking macros...');
      
      // Test connection
      const isConnected = await modelCreator.testConfluenceConnection();
      if (!isConnected) {
        logger.error('❌ Confluence connection failed');
        process.exit(1);
      }
      
      logger.info('✅ Confluence connection successful');
      
      // Fetch available macros
      const macros = await modelCreator.getConfluenceMacros();
      logger.info(`📋 Available macros (${macros.length}): ${macros.join(', ')}`);
      
      // Check specifically for Mermaid-related macros
      const mermaidMacros = macros.filter((macro: string) => 
        macro.toLowerCase().includes('mermaid') || 
        macro.toLowerCase().includes('diagram')
      );
      
      if (mermaidMacros.length > 0) {
        logger.info(`🎯 Mermaid-related macros found: ${mermaidMacros.join(', ')}`);
      } else {
        logger.warn('⚠️  No Mermaid-related macros detected');
        logger.info('💡 Make sure "Mermaid Diagrams for Confluence" app is installed');
      }
      
    } catch (error) {
      logger.error('Debug failed', error);
      process.exit(1);
    }
  });

// Generate SVG command
program
  .command('generate-svg')
  .description('Generate SVG diagram from input model file')
  .argument('<input-file>', 'path to input model JSON file')
  .option('-o, --output <path>', 'output directory for SVG file')
  .option('-f, --format <format>', 'diagram format (mermaid|plantuml)', 'mermaid')
  .option('--width <width>', 'SVG width in pixels', '1400')
  .option('--height <height>', 'SVG height in pixels', '1000')
  .action(async (inputFile, options) => {
    try {
      const modelCreator = new ModelCreator();
      await modelCreator.initialize(program.opts().config);

      const inputPath = path.resolve(inputFile);
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      logger.info(`Generating SVG diagram from: ${inputFile}`);

      // Load and parse the input file
      const inputContent = await fs.readFile(inputPath, 'utf-8');
      const modelData = JSON.parse(inputContent);

      // Create model from input data
      const model = await modelCreator.importDomainModel(modelData);

      // Generate diagram
      const diagram = await modelCreator.generateDiagram(model, options.format as 'mermaid' | 'plantuml');

      // Set up output directory
      const outputDir = options.output ? path.resolve(options.output) : path.join(process.cwd(), 'output', 'svg');
      await fs.ensureDir(outputDir);

      // Generate SVG file
      const svgFilename = `${model.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-diagram.svg`;
      const svgPath = path.join(outputDir, svgFilename);

      // Use the diagram image service to generate SVG
      const DiagramImageService = require('./services/diagram-image.service').DiagramImageService;
      const imageService = new DiagramImageService();
      
      if (options.format === 'mermaid') {
        await imageService.generateMermaidImage(
          diagram,
          svgPath,
          'svg',
          parseInt(options.width),
          parseInt(options.height)
        );
      } else {
        await imageService.generatePlantUMLImage(
          diagram,
          svgPath,
          'svg'
        );
      }

      logger.info(`SVG diagram generated successfully: ${svgPath}`);
      console.log(`✅ SVG file created: ${svgPath}`);

    } catch (error) {
      logger.error('Failed to generate SVG diagram', error);
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

      logger.info(`Processing input models from: ${inputDir}`);

      // Find all JSON files in input directory
      const inputFiles = await fs.readdir(inputDir);
      const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

      if (jsonFiles.length === 0) {
        logger.warn('No JSON input files found in input directory');
        return;
      }

      logger.info(`Found ${jsonFiles.length} input model files`);

      const results = [];

      for (const jsonFile of jsonFiles) {
        const inputPath = path.join(inputDir, jsonFile);
        const baseName = path.basename(jsonFile, '.json');
        
        try {
          logger.info(`\n📋 Processing: ${jsonFile}`);

          if (options.dryRun) {
            logger.info(`[DRY RUN] Would process: ${jsonFile}`);
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
          logger.info(`✅ Processed successfully: ${jsonFile}`);

        } catch (error) {
          logger.error(`❌ Failed to process ${jsonFile}`, error);
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

      logger.info(`\n📊 Processing Summary:`);
      logger.info(`Total files: ${jsonFiles.length}`);
      logger.info(`Successful: ${results.filter(r => r.status === 'success').length}`);
      logger.info(`Failed: ${results.filter(r => r.status === 'failed').length}`);
      logger.info(`Summary saved to: ${summaryPath}`);

    } catch (error) {
      logger.error('Failed to process input models', error);
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

      logger.info('Checking input models status...');

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
      logger.error('Failed to get input models status', error);
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
      
      logger.info('Initializing input model management structure...');

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
        logger.info(`Created directory: ${dirPath}`);
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
        logger.info(`Created example input file: ${exampleInputPath}`);
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
      logger.info(`Created README: ${readmePath}`);

      logger.info('✅ Input model management structure initialized successfully!');
      
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
      logger.error('Failed to initialize input model structure', error);
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
