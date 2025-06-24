#!/usr/bin/env node

/**
 * Comprehensive sync script for all models
 * Creates Confluence index page with subpages for each model
 */

const { ModelCreator } = require('./dist/model-creator.js');
const path = require('path');
const fs = require('fs-extra');

async function syncAllModels() {
  console.log('🚀 Starting comprehensive model sync...\n');

  const modelCreator = new ModelCreator();
  await modelCreator.initialize();

  // Get all input models
  const inputDir = path.resolve('./inputs');
  const inputFiles = await fs.readdir(inputDir);
  const jsonFiles = inputFiles.filter(file => file.endsWith('.json'));

  console.log(`📋 Found ${jsonFiles.length} model files:`);
  jsonFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');

  const modelInfos = [];

  // Process each model
  for (const jsonFile of jsonFiles) {
    console.log(`📊 Processing: ${jsonFile}`);
    
    try {
      const inputPath = path.join(inputDir, jsonFile);
      const inputContent = await fs.readFile(inputPath, 'utf-8');
      const model = JSON.parse(inputContent);

      // Generate diagram
      const diagram = await modelCreator.generateDiagram(model, 'mermaid');

      // Save to Git
      const modelPath = await modelCreator.saveDomainModelToGit(model, `${path.basename(jsonFile, '.json')}.model.json`);
      const diagramPath = await modelCreator.saveDiagramToGit(
        diagram,
        `${path.basename(jsonFile, '.json')}-diagram`,
        'mermaid'
      );

      // Sync with Confluence (creates individual page)
      const gitFileUrls = {
        modelUrl: `https://github.com/theetje/insurance-domain-models/blob/main/${modelPath}`,
        diagramUrl: `https://github.com/theetje/insurance-domain-models/blob/main/${diagramPath}`
      };

      const pageId = await modelCreator.syncWithConfluence(
        model,
        diagram,
        'mermaid',
        gitFileUrls
      );

      modelInfos.push({
        name: model.name,
        version: model.version,
        pageId: pageId,
        lastUpdated: new Date().toISOString(),
        gitModel: modelPath,
        gitDiagram: diagramPath
      });

      console.log(`   ✅ ${model.name} → Page ID: ${pageId}`);

    } catch (error) {
      console.error(`   ❌ Failed to process ${jsonFile}:`, error.message);
    }
  }

  // Commit all changes to Git
  try {
    await modelCreator.commitAndPushChanges(`Sync all models: ${modelInfos.map(m => m.name).join(', ')}`);
    console.log('\n✅ All changes committed and pushed to Git');
  } catch (error) {
    console.error('\n❌ Failed to commit to Git:', error.message);
  }

  // Create Confluence index page
  if (modelInfos.length > 0) {
    try {
      console.log('\n📖 Creating Confluence index page...');
      
      // Note: The createModelIndexPage method exists in ConfluenceService
      // but may need some adjustment to work properly
      const confluenceService = modelCreator.confluenceService;
      
      if (confluenceService && confluenceService.createModelIndexPage) {
        const indexPageId = await confluenceService.createModelIndexPage(modelInfos);
        console.log(`✅ Index page created: ${indexPageId}`);
      } else {
        console.log('⚠️  Index page creation not available - create manually');
      }
    } catch (error) {
      console.error('❌ Failed to create index page:', error.message);
    }
  }

  // Generate summary report
  const summary = {
    timestamp: new Date().toISOString(),
    totalModels: modelInfos.length,
    models: modelInfos,
    gitRepository: 'https://github.com/theetje/insurance-domain-models.git',
    confluenceSpace: 'Documentat'
  };

  await fs.writeFile('./sync-summary.json', JSON.stringify(summary, null, 2));
  
  console.log('\n📋 Sync Summary:');
  console.log(`   Total Models: ${modelInfos.length}`);
  console.log(`   Git Repository: https://github.com/theetje/insurance-domain-models`);
  console.log(`   Confluence Space: Documentat`);
  console.log(`   Summary saved to: sync-summary.json`);
  
  console.log('\n🎉 Comprehensive sync completed!');
}

// Run the sync
syncAllModels().catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
});
