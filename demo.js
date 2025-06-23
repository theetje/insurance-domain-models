const { ModelCreator } = require('./dist/index.js');

async function demo() {
  console.log('🚀 Starting Model Creator Demo');
  
  const modelCreator = new ModelCreator();
  
  // Create a domain model
  const model = await modelCreator.createDomainModel(
    'Demo Insurance Model',
    'A demonstration of SIVI AFD 2.0 compliant insurance domain model'
  );
  
  console.log(`✅ Created model: ${model.name}`);
  console.log(`📊 Entities: ${model.entities.length}`);
  console.log(`🏗️ SIVI Version: ${model.metadata.siviVersion}`);
  
  // Generate a Mermaid diagram
  const mermaidDiagram = await modelCreator.generateDiagram(model, 'mermaid');
  console.log('\n📈 Generated Mermaid Diagram:');
  console.log('='.repeat(50));
  console.log(mermaidDiagram.substring(0, 500) + '...');
  
  // Generate a PlantUML diagram
  const plantumlDiagram = await modelCreator.generateDiagram(model, 'plantuml');
  console.log('\n📈 Generated PlantUML Diagram:');
  console.log('='.repeat(50));
  console.log(plantumlDiagram.substring(0, 500) + '...');
  
  // Generate sequence diagrams
  const policyCreationSequence = modelCreator.generateSequenceDiagram('policy-creation', 'mermaid');
  console.log('\n🔄 Generated Policy Creation Sequence:');
  console.log('='.repeat(50));
  console.log(policyCreationSequence.substring(0, 300) + '...');
  
  const claimProcessingSequence = modelCreator.generateSequenceDiagram('claim-processing', 'mermaid');
  console.log('\n🔄 Generated Claim Processing Sequence:');
  console.log('='.repeat(50));
  console.log(claimProcessingSequence.substring(0, 300) + '...');
  
  console.log('\n🎉 Demo completed successfully!');
  console.log('\n📋 Model Summary:');
  console.log(`   Name: ${model.name}`);
  console.log(`   Version: ${model.version}`);
  console.log(`   Namespace: ${model.namespace}`);
  console.log(`   Entities: ${model.entities.map(e => e.name).join(', ')}`);
  console.log(`   Created: ${model.metadata.created}`);
}

demo().catch(console.error);
