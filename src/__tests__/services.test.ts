import { SiviService } from '../services/sivi.service';
import { DiagramService } from '../services/diagram.service';

describe('SiviService', () => {
  let siviService: SiviService;

  beforeEach(() => {
    siviService = new SiviService();
  });

  test('should create domain model with SIVI AFD 2.0 entities', () => {
    const model = siviService.createDomainModel('Test Model', 'Test description');
    
    expect(model.name).toBe('Test Model');
    expect(model.description).toBe('Test description');
    expect(model.entities.length).toBeGreaterThan(0);
    expect(model.metadata.siviVersion).toBe('2.0');
  });

  test('should validate domain model successfully', () => {
    const model = siviService.createDomainModel('Test Model');
    
    expect(() => {
      siviService.validateDomainModel(model);
    }).not.toThrow();
  });

  test('should get core entities', () => {
    const entities = siviService.getCoreEntities();
    
    expect(entities.length).toBe(7); // Policy, Coverage, Party, Claim, Premium, Object, Clause
    expect(entities.find(e => e.name === 'Policy')).toBeDefined();
    expect(entities.find(e => e.name === 'Coverage')).toBeDefined();
  });
});

describe('DiagramService', () => {
  let diagramService: DiagramService;
  let siviService: SiviService;

  beforeEach(() => {
    diagramService = new DiagramService();
    siviService = new SiviService();
  });

  test('should generate Mermaid diagram', () => {
    const model = siviService.createDomainModel('Test Model');
    const config = {
      format: 'mermaid' as const,
      direction: 'TB' as const,
      showAttributes: true,
      showMethods: false,
      showRelationships: true,
      includeMetadata: true
    };

    const diagram = diagramService.generateDiagram(model, config);
    
    expect(diagram).toContain('classDiagram');
    expect(diagram).toContain('class Policy');
    expect(diagram).toContain('class Coverage');
  });

  test('should generate PlantUML diagram', () => {
    const model = siviService.createDomainModel('Test Model');
    const config = {
      format: 'plantuml' as const,
      direction: 'TB' as const,
      showAttributes: true,
      showMethods: false,
      showRelationships: true,
      includeMetadata: true
    };

    const diagram = diagramService.generateDiagram(model, config);
    
    expect(diagram).toContain('@startuml');
    expect(diagram).toContain('@enduml');
    expect(diagram).toContain('class Policy');
  });

  test('should generate sequence diagram', () => {
    const diagram = diagramService.generateSequenceDiagram('policy-creation', 'mermaid');
    
    expect(diagram).toContain('sequenceDiagram');
    expect(diagram).toContain('Policy Creation Process');
    expect(diagram).toContain('Customer');
    expect(diagram).toContain('Broker');
  });
});
