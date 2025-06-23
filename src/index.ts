/**
 * @hienfeld/model-creator
 * 
 * Comprehensive tool for integrating Git-based UML domain models with Confluence using SIVI AFD 2.0
 * 
 * This tool provides:
 * - SIVI AFD 2.0 compliant domain model creation
 * - UML diagram generation (Mermaid/PlantUML)
 * - Git version control integration
 * - Confluence Cloud documentation synchronization
 * - Complete workflow automation
 * 
 * @author Hienfeld
 * @version 1.0.0
 */

// Main exports
export { ModelCreator } from './model-creator';

// Core services
export { SiviService } from './services/sivi.service';
export { DiagramService } from './services/diagram.service';
export { GitService } from './services/git.service';
export { ConfluenceService } from './services/confluence.service';

// Utilities
export { Logger } from './utils/logger';
export { ConfigManager } from './utils/config';

// Types
export * from './types';

// Default export for convenience
import { ModelCreator } from './model-creator';
export default ModelCreator;
