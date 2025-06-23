/**
 * Core types and interfaces for the Model Creator tool
 */

import { z } from 'zod';

// SIVI AFD 2.0 Core Entity Types
export const SiviEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['Policy', 'Coverage', 'Party', 'Claim', 'Premium', 'Object', 'Clause']),
  attributes: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
    description: z.string().optional(),
    siviReference: z.string().optional()
  })),
  relationships: z.array(z.object({
    type: z.enum(['association', 'aggregation', 'composition', 'inheritance']),
    target: z.string(),
    cardinality: z.string(),
    description: z.string().optional()
  })).default([]),
  siviReference: z.string().optional(),
  version: z.string().default('2.0')
});

export type SiviEntity = z.infer<typeof SiviEntitySchema>;

// UML Diagram Configuration
export const DiagramConfigSchema = z.object({
  format: z.enum(['mermaid', 'plantuml']).default('mermaid'),
  theme: z.string().optional(),
  direction: z.enum(['TB', 'TD', 'BT', 'RL', 'LR']).default('TB'),
  showAttributes: z.boolean().default(true),
  showMethods: z.boolean().default(false),
  showRelationships: z.boolean().default(true),
  includeMetadata: z.boolean().default(true)
});

export type DiagramConfig = z.infer<typeof DiagramConfigSchema>;

// Domain Model Structure
export const DomainModelSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  namespace: z.string().optional(),
  entities: z.array(SiviEntitySchema),
  metadata: z.object({
    created: z.string(),
    updated: z.string(),
    author: z.string().optional(),
    siviVersion: z.string().default('2.0')
  })
});

export type DomainModel = z.infer<typeof DomainModelSchema>;

// Git Configuration
export const GitConfigSchema = z.object({
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  branch: z.string().default('main'),
  username: z.string().optional(),
  token: z.string().optional(),
  modelsPath: z.string().default('models'),
  outputPath: z.string().default('output')
});

export type GitConfig = z.infer<typeof GitConfigSchema>;

// Confluence Configuration
export const ConfluenceConfigSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal('')),
  username: z.string(),
  apiToken: z.string(),
  spaceKey: z.string(),
  pageTitle: z.string().optional(),
  parentPageId: z.string().optional()
});

export type ConfluenceConfig = z.infer<typeof ConfluenceConfigSchema>;

// Application Configuration
export const AppConfigSchema = z.object({
  git: GitConfigSchema,
  confluence: ConfluenceConfigSchema,
  diagram: DiagramConfigSchema,
  sivi: z.object({
    baseUrl: z.string().url().optional().or(z.literal('')).default('https://www.sivi.org/afd'),
    version: z.string().default('2.0')
  }),
  output: z.object({
    directory: z.string().default('./output'),
    modelsDirectory: z.string().default('./models')
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    file: z.string().optional()
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// Command Line Options
export interface CLIOptions {
  config?: string;
  output?: string;
  format?: 'mermaid' | 'plantuml';
  verbose?: boolean;
  dryRun?: boolean;
}

// Integration Status
export interface IntegrationStatus {
  git: {
    connected: boolean;
    lastSync: string | null;
    branch: string;
    commitHash: string | null;
  };
  confluence: {
    connected: boolean;
    lastUpdate: string | null;
    pageId: string | null;
  };
  models: {
    count: number;
    lastModified: string | null;
  };
}

// Error Types
export class ModelCreatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ModelCreatorError';
  }
}

export class SiviValidationError extends ModelCreatorError {
  constructor(message: string, details?: any) {
    super(message, 'SIVI_VALIDATION_ERROR', details);
  }
}

export class GitIntegrationError extends ModelCreatorError {
  constructor(message: string, details?: any) {
    super(message, 'GIT_INTEGRATION_ERROR', details);
  }
}

export class ConfluenceIntegrationError extends ModelCreatorError {
  constructor(message: string, details?: any) {
    super(message, 'CONFLUENCE_INTEGRATION_ERROR', details);
  }
}
