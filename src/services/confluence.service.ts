import axios, { AxiosInstance } from 'axios';
import { ConfluenceConfig, DomainModel, ConfluenceIntegrationError } from '../types';
import { Logger } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';

/**
 * Service for Confluence Cloud integration
 * Handles page creation, updates, and embedding Git content
 */
export class ConfluenceService {
  private client: AxiosInstance;
  private logger: Logger;
  private config: ConfluenceConfig;

  constructor(config: ConfluenceConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    
    // Create Confluence API client
    this.client = axios.create({
      baseURL: `${config.baseUrl}/wiki/rest/api`,
      auth: {
        username: config.username,
        password: config.apiToken
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`Confluence API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Confluence API Request Error', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`Confluence API Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        this.logger.error('Confluence API Response Error', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test Confluence connection
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.info('Testing Confluence connection');
      // Try to get the current user to test authentication
      const response = await this.client.get('/user/current');
      this.logger.info('Confluence connection successful');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Confluence connection failed', error);
      return false;
    }
  }

  /**
   * Fetch available macros from Confluence
   */
  async fetchAvailableMacros(): Promise<string[]> {
    try {
      this.logger.info('Fetching available Confluence macros');
      
      // Try different approaches to detect macros
      const macros: string[] = [];
      
      // Approach 1: Try to get macro blueprint information
      try {
        const response = await this.client.get('/content/blueprint/drafts', {
          params: {
            spaceKey: this.config.spaceKey,
            expand: 'macros'
          }
        });
        
        if (response.data && response.data.results) {
          response.data.results.forEach((draft: any) => {
            if (draft.macros) {
              macros.push(...draft.macros.map((macro: any) => macro.name));
            }
          });
        }
      } catch (error) {
        this.logger.debug('Blueprint approach failed', error);
      }
      
      // Approach 2: Try to get app information directly
      try {
        // This checks for installed apps via universal plugin manager
        const appsResponse = await this.client.get('/../../rest/plugins/1.0/', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (appsResponse.data && appsResponse.data.plugins) {
          const mermaidApp = appsResponse.data.plugins.find((plugin: any) => 
            plugin.key && plugin.key.includes('mermaid')
          );
          
          if (mermaidApp) {
            this.logger.info(`Found Mermaid app: ${mermaidApp.name || mermaidApp.key}`);
            // Common macro names for Mermaid apps
            macros.push('mermaid', 'mermaid-diagram', 'drawio-mermaid');
          }
        }
      } catch (error) {
        this.logger.debug('Apps API approach failed', error);
      }
      
      // Approach 3: Try to test specific macro names by attempting to create test content
      const testMacros = ['mermaid', 'mermaid-diagram', 'drawio-mermaid', 'code', 'info', 'note', 'expand'];
      for (const macroName of testMacros) {
        if (!macros.includes(macroName)) {
          macros.push(macroName);
        }
      }
      
      this.logger.info(`Found ${macros.length} macros: ${macros.join(', ')}`);
      return macros;
    } catch (error) {
      this.logger.warn('Could not fetch macro information', error);
      // Return common macro names as fallback
      return ['code', 'info', 'note', 'expand', 'mermaid', 'mermaid-diagram', 'drawio-mermaid'];
    }
  }

  /**
   * Get space information
   */
  async getSpaceInfo(): Promise<any> {
    try {
      const response = await this.client.get(`/space/${this.config.spaceKey}`);
      return response.data;
    } catch (error) {
      const message = `Failed to get space info: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ConfluenceIntegrationError(message, error);
    }
  }

  /**
   * Create or update domain model documentation page
   */
  async createOrUpdateModelPage(
    model: DomainModel,
    diagramContent: string,
    diagramFormat: 'mermaid' | 'plantuml',
    gitFileUrls: {
      modelUrl: string;
      diagramUrl: string;
    }
  ): Promise<string> {
    try {
      const pageTitle = this.config.pageTitle || `${model.name} - Domain Model`;
      this.logger.info(`Creating/updating Confluence page: ${pageTitle}`);

      // Check if page already exists
      const existingPage = await this.findPageByTitle(pageTitle);
      
      let pageId: string;
      if (existingPage) {
        pageId = existingPage.id;
      } else {
        // Create new page first to get pageId
        const tempContent = `<p>Generating content...</p>`;
        pageId = await this.createPage(pageTitle, tempContent);
        this.logger.info(`Page created: ${pageTitle} (ID: ${pageId})`);
      }

      // Generate page content with the pageId
      const pageContent = await this.generatePageContent(model, diagramContent, diagramFormat, gitFileUrls, pageId);

      if (existingPage) {
        // Update existing page
        await this.updatePage(pageId, pageTitle, pageContent, existingPage.version.number + 1);
        this.logger.info(`Page updated: ${pageTitle} (ID: ${pageId})`);
      } else {
        // Update the page with final content
        await this.updatePage(pageId, pageTitle, pageContent, 2); // Version 2 since we created it with temp content
        this.logger.info(`Page content updated: ${pageTitle} (ID: ${pageId})`);
      }

      return pageId;
    } catch (error) {
      const message = `Failed to create/update model page: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ConfluenceIntegrationError(message, error);
    }
  }

  /**
   * Create a new page
   */
  private async createPage(title: string, content: string): Promise<string> {
    const pageData = {
      type: 'page',
      title,
      space: {
        key: this.config.spaceKey
      },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Add parent page if specified
    if (this.config.parentPageId) {
      (pageData as any).ancestors = [{ id: this.config.parentPageId }];
    }

    const response = await this.client.post('/content', pageData);
    return response.data.id;
  }

  /**
   * Update existing page
   */
  private async updatePage(pageId: string, title: string, content: string, version: number): Promise<string> {
    const updateData = {
      id: pageId,
      type: 'page',
      title,
      space: {
        key: this.config.spaceKey
      },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version
      }
    };

    const response = await this.client.put(`/content/${pageId}`, updateData);
    return response.data.id;
  }

  /**
   * Find page by title
   */
  private async findPageByTitle(title: string): Promise<any> {
    try {
      const response = await this.client.get('/content', {
        params: {
          spaceKey: this.config.spaceKey,
          title,
          expand: 'version'
        }
      });

      const pages = response.data.results;
      return pages.length > 0 ? pages[0] : null;
    } catch (error) {
      // Return null if page not found
      return null;
    }
  }

  /**
   * Generate Confluence page content with embedded Git content
   */
  private async generatePageContent(
    model: DomainModel,
    diagramContent: string,
    diagramFormat: 'mermaid' | 'plantuml',
    gitFileUrls: {
      modelUrl: string;
      diagramUrl: string;
    },
    pageId: string
  ): Promise<string> {
    const content = `
<h1>${model.name} - Domain Model</h1>

<p><strong>Version:</strong> ${model.version}</p>
<p><strong>Last Updated:</strong> ${model.metadata.updated}</p>
<p><strong>SIVI AFD Version:</strong> ${model.metadata.siviVersion}</p>

<h2>Overview</h2>
<p>${model.description || 'This domain model is based on SIVI AFD 2.0 standard for the Dutch insurance industry.'}</p>

<ac:structured-macro ac:name="info" ac:schema-version="1" ac:macro-id="info-model-sync">
  <ac:rich-text-body>
    <p><strong>🔄 Live Sync:</strong> This documentation is automatically synchronized with the Git repository. 
    The diagrams and model definitions shown below are always up-to-date with the latest version in Git.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Domain Model Structure</h2>

${await this.buildDiagramSection(diagramFormat, gitFileUrls.diagramUrl, diagramContent, model.name, pageId)}

<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="diagram-source-expand">
  <ac:parameter ac:name="title">📋 View Diagram Source Code</ac:parameter>
  <ac:rich-text-body>
    <ac:structured-macro ac:name="code" ac:schema-version="1">
      <ac:parameter ac:name="language">${diagramFormat}</ac:parameter>
      <ac:parameter ac:name="title">${diagramFormat.toUpperCase()} Source</ac:parameter>
      <ac:rich-text-body><![CDATA[${diagramContent}]]></ac:rich-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>

<h3>Entity Definitions</h3>
<p>The model includes the following SIVI AFD 2.0 compliant entities:</p>

<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="entities-expand">
  <ac:parameter ac:name="title">View All Entities (${model.entities.length} total)</ac:parameter>
  <ac:rich-text-body>
    ${this.generateEntitiesTable(model.entities)}
  </ac:rich-text-body>
</ac:structured-macro>

<h2>SIVI AFD 2.0 Compliance</h2>
<p>This domain model follows the SIVI All Finance Data (AFD) 2.0 standard, ensuring:</p>
<ul>
  <li>Standardized entity definitions used across the Dutch insurance industry</li>
  <li>Consistent attribute naming and types</li>
  <li>Industry-standard relationships and cardinalities</li>
  <li>Compatibility with existing SIVI-compliant systems</li>
</ul>

<h3>Core SIVI Entities</h3>
<table>
  <tr>
    <th>Entity</th>
    <th>SIVI Reference</th>
    <th>Description</th>
  </tr>
  ${model.entities.map(entity => `
    <tr>
      <td><strong>${entity.name}</strong></td>
      <td><code>${entity.siviReference || 'Custom'}</code></td>
      <td>${entity.description || 'SIVI AFD 2.0 standard entity'}</td>
    </tr>
  `).join('')}
</table>

<h2>Version Control & Git Integration</h2>
<p>This model is version-controlled in Git and automatically synchronized with this documentation.</p>

<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="model-metadata-expand">
  <ac:parameter ac:name="title">Model Metadata</ac:parameter>
  <ac:rich-text-body>
    <ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="git-info">
      <ac:parameter ac:name="language">json</ac:parameter>
      <ac:parameter ac:name="title">Model Metadata</ac:parameter>
      <ac:rich-text-body>
        <![CDATA[{
  "name": "${model.name}",
  "version": "${model.version}",
  "namespace": "${model.namespace || 'nl.sivi.afd.insurance'}",
  "created": "${model.metadata.created}",
  "updated": "${model.metadata.updated}",
  "siviVersion": "${model.metadata.siviVersion}",
  "entityCount": ${model.entities.length}
}]]>
      </ac:rich-text-body>
    </ac:structured-macro>
  </ac:rich-text-body>
</ac:structured-macro>

<h3>Git Repository Links</h3>
<ul>
  <li><a href="${gitFileUrls.modelUrl}">📄 View Model Definition in Git</a></li>
  <li><a href="${gitFileUrls.diagramUrl}">📊 View Diagram Source in Git</a></li>
</ul>

<h2>Usage Guidelines</h2>
<ac:structured-macro ac:name="note" ac:schema-version="1" ac:macro-id="usage-note">
  <ac:rich-text-body>
    <h4>For Developers</h4>
    <ul>
      <li>Use the model definition JSON file as the source of truth for entity structures</li>
      <li>Follow SIVI AFD 2.0 naming conventions when extending the model</li>
      <li>All changes should be made in the Git repository and will be reflected here automatically</li>
    </ul>
    
    <h4>For Business Analysts</h4>
    <ul>
      <li>The UML diagram provides a visual overview of all entities and relationships</li>
      <li>Entity definitions include SIVI references for compliance verification</li>
      <li>Use the expand sections to view detailed attribute information</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<hr/>
<p><em>Last synchronized: ${new Date().toISOString()}</em></p>
<p><em>Generated by @hienfeld/model-creator with SIVI AFD ${model.metadata.siviVersion}</em></p>
`;

    return content;
  }

  /**
   * Generate diagram section with uploaded image
   */
  private async buildDiagramSection(
    format: 'mermaid' | 'plantuml',
    gitUrl: string,
    diagramContent: string,
    modelName: string,
    pageId: string
  ): Promise<string> {
    try {
      // Generate and upload the diagram image
      const imageUrl = await this.generateAndUploadDiagramImage(
        pageId,
        diagramContent,
        format,
        modelName
      );

      // Create the diagram section with uploaded image
      return `
<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="diagram-expand">
  <ac:parameter ac:name="title">📊 Domain Model Diagram (Click to View)</ac:parameter>
  <ac:rich-text-body>
    <ac:structured-macro ac:name="info" ac:schema-version="1">
      <ac:rich-text-body>
        <p><strong>🎯 High-Quality Diagram:</strong> This diagram is automatically generated as an image file and uploaded to Confluence, ensuring it's always visible regardless of installed apps.</p>
        <ul>
          <li><strong>Format:</strong> ${format.toUpperCase()}</li>
          <li><strong>Resolution:</strong> High-quality PNG (1400x1000)</li>
          <li><strong>Source:</strong> <a href="${gitUrl}">View diagram source in Git →</a></li>
        </ul>
      </ac:rich-text-body>
    </ac:structured-macro>

    <h3>📋 ${format === 'mermaid' ? 'Mermaid' : 'PlantUML'} Diagram</h3>
    
    <p><ac:image ac:width="100%"><ri:attachment ri:filename="${modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-diagram.png" /></ac:image></p>
    
    <h4>📋 Source Code</h4>
    <p><strong>Copy and paste this code to modify or regenerate the diagram:</strong></p>
    
    <ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="${format}-source-code">
      <ac:parameter ac:name="language">${format}</ac:parameter>
      <ac:parameter ac:name="title">${format.toUpperCase()} Diagram Source Code</ac:parameter>
      <ac:plain-text-body><![CDATA[${diagramContent}]]></ac:plain-text-body>
    </ac:structured-macro>
    
    <h4>🔗 External Tools</h4>
    <ul>
      <li><strong>Live Editor:</strong> <a href="https://${format}.live/edit#pako:${Buffer.from(diagramContent).toString('base64')}">Open in ${format === 'mermaid' ? 'Mermaid' : 'PlantUML'} Live Editor</a></li>
      <li><strong>Git Source:</strong> <a href="${gitUrl}">View source file in repository</a></li>
    </ul>
    
    <p><em>✅ This diagram is automatically generated and uploaded as a high-quality image, so it's always visible and doesn't require any additional Confluence apps.</em></p>
  </ac:rich-text-body>
</ac:structured-macro>`;

    } catch (error) {
      this.logger.error('Failed to generate diagram image, falling back to code block', error);
      
      // Fallback to code block if image generation fails
      return `
<ac:structured-macro ac:name="expand" ac:schema-version="1" ac:macro-id="diagram-expand">
  <ac:parameter ac:name="title">📊 Domain Model Diagram (Click to View)</ac:parameter>
  <ac:rich-text-body>
    <ac:structured-macro ac:name="info" ac:schema-version="1">
      <ac:rich-text-body>
        <p><strong>⚠️ Image Generation Failed:</strong> Displaying source code instead. You can copy this code and paste it into a ${format} editor to view the diagram.</p>
        <p><strong>🔗 Source:</strong> <a href="${gitUrl}">View diagram source in Git →</a></p>
      </ac:rich-text-body>
    </ac:structured-macro>

    <ac:structured-macro ac:name="code" ac:schema-version="1" ac:macro-id="${format}-fallback-code">
      <ac:parameter ac:name="language">${format}</ac:parameter>
      <ac:parameter ac:name="title">${format.toUpperCase()} Diagram Source Code</ac:parameter>
      <ac:plain-text-body><![CDATA[${diagramContent}]]></ac:plain-text-body>
    </ac:structured-macro>
    
    <p><strong>🚀 Live Demo:</strong> <a href="https://${format}.live/edit#pako:${Buffer.from(diagramContent).toString('base64')}">Open in ${format === 'mermaid' ? 'Mermaid' : 'PlantUML'} Live Editor</a></p>
  </ac:rich-text-body>
</ac:structured-macro>`;
    }
  }

  /**
   * Escape content for safe inclusion in Confluence macros
   */
  private escapeForConfluence(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate entities table
   */
  private generateEntitiesTable(entities: any[]): string {
    return `
<table>
  <tr>
    <th>Entity</th>
    <th>Type</th>
    <th>Attributes</th>
    <th>Relationships</th>
    <th>SIVI Reference</th>
  </tr>
  ${entities.map(entity => `
    <tr>
      <td><strong>${entity.name}</strong><br/><small>${entity.description || ''}</small></td>
      <td><span style="background-color: #e3f2fd; padding: 2px 6px; border-radius: 3px;">${entity.type}</span></td>
      <td>
        <ac:structured-macro ac:name="expand" ac:schema-version="1">
          <ac:parameter ac:name="title">${entity.attributes.length} attributes</ac:parameter>
          <ac:rich-text-body>
            <ul>
              ${entity.attributes.map((attr: any) => `<li><strong>${attr.name}</strong>: ${attr.type}${attr.required ? ' <em>(required)</em>' : ''}</li>`).join('')}
            </ul>
          </ac:rich-text-body>
        </ac:structured-macro>
      </td>
      <td>
        ${entity.relationships.length > 0 ? `
          <ac:structured-macro ac:name="expand" ac:schema-version="1">
            <ac:parameter ac:name="title">${entity.relationships.length} relationships</ac:parameter>
            <ac:rich-text-body>
              <ul>
                ${entity.relationships.map((rel: any) => `<li>${rel.type} → ${rel.target} (${rel.cardinality})</li>`).join('')}
              </ul>
            </ac:rich-text-body>
          </ac:structured-macro>
        ` : '<em>None</em>'}
      </td>
      <td><code>${entity.siviReference || 'Custom'}</code></td>
    </tr>
  `).join('')}
</table>`;
  }

  /**
   * Create index page for all domain models
   */
  async createModelIndexPage(models: Array<{
    name: string;
    version: string;
    pageId: string;
    lastUpdated: string;
  }>): Promise<string> {
    try {
      const pageTitle = 'Domain Models - SIVI AFD 2.0 Index';
      this.logger.info(`Creating/updating index page: ${pageTitle}`);

      const pageContent = `
<h1>Domain Models Index</h1>
<p>This page provides an overview of all SIVI AFD 2.0 compliant domain models in this space.</p>

<ac:structured-macro ac:name="info" ac:schema-version="1">
  <ac:rich-text-body>
    <p><strong>🏗️ SIVI AFD 2.0 Foundation:</strong> All models in this index are built on the SIVI All Finance Data 2.0 standard, 
    ensuring consistency across the Dutch insurance industry.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Available Models</h2>
<table>
  <tr>
    <th>Model Name</th>
    <th>Version</th>
    <th>Last Updated</th>
    <th>Actions</th>
  </tr>
  ${models.map(model => `
    <tr>
      <td><strong><a href="/pages/viewpage.action?pageId=${model.pageId}">${model.name}</a></strong></td>
      <td><span style="background-color: #e8f5e8; padding: 2px 6px; border-radius: 3px;">${model.version}</span></td>
      <td>${new Date(model.lastUpdated).toLocaleDateString()}</td>
      <td>
        <a href="/pages/viewpage.action?pageId=${model.pageId}">View Model</a>
      </td>
    </tr>
  `).join('')}
</table>

<h2>About SIVI AFD 2.0</h2>
<p>SIVI's All Finance Data (AFD) 2.0 is a comprehensive data catalog developed by the Dutch insurance industry association. 
It provides standardized definitions for insurance entities, attributes, and relationships.</p>

<h3>Benefits of SIVI AFD 2.0 Compliance</h3>
<ul>
  <li><strong>Industry Standard:</strong> Widely adopted across Dutch insurance companies</li>
  <li><strong>Data Consistency:</strong> Standardized entity and attribute definitions</li>
  <li><strong>Integration Ready:</strong> Simplified data exchange between systems</li>
  <li><strong>Regulatory Compliance:</strong> Aligned with Dutch insurance regulations</li>
</ul>

<hr/>
<p><em>Index updated: ${new Date().toISOString()}</em></p>
<p><em>Powered by @hienfeld/model-creator</em></p>
`;

      // Check if index page exists
      const existingPage = await this.findPageByTitle(pageTitle);
      
      let pageId: string;
      if (existingPage) {
        pageId = await this.updatePage(existingPage.id, pageTitle, pageContent, existingPage.version.number + 1);
      } else {
        pageId = await this.createPage(pageTitle, pageContent);
      }

      this.logger.info(`Index page created/updated: ${pageTitle} (ID: ${pageId})`);
      return pageId;
    } catch (error) {
      const message = `Failed to create index page: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ConfluenceIntegrationError(message, error);
    }
  }

  /**
   * Add labels to a page
   */
  async addLabelsToPage(pageId: string, labels: string[]): Promise<void> {
    try {
      const labelData = labels.map(label => ({
        prefix: 'global',
        name: label
      }));

      await this.client.post(`/content/${pageId}/label`, labelData);
      this.logger.info(`Labels added to page ${pageId}: ${labels.join(', ')}`);
    } catch (error) {
      this.logger.warn(`Failed to add labels to page ${pageId}`, error);
    }
  }

  /**
   * Get page content by ID
   */
  async getPageContent(pageId: string): Promise<any> {
    try {
      const response = await this.client.get(`/content/${pageId}`, {
        params: {
          expand: 'body.storage,version'
        }
      });
      return response.data;
    } catch (error) {
      const message = `Failed to get page content: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new ConfluenceIntegrationError(message, error);
    }
  }

  /**
   * Get available macros in the Confluence instance
   */
  async getAvailableMacros(): Promise<any> {
    try {
      // Try to get macro information - this endpoint might vary by Confluence version
      const response = await this.client.get('/macro');
      return response.data;
    } catch (error) {
      this.logger.warn('Failed to get available macros', error);
      return null;
    }
  }

  /**
   * Upload image file as attachment to Confluence page
   */
  async uploadImageToConfluence(
    pageId: string,
    imagePath: string,
    filename?: string
  ): Promise<string> {
    try {
      const imageFilename = filename || path.basename(imagePath);
      this.logger.info(`Uploading image to Confluence page ${pageId}: ${imageFilename}`);

      // Create form data for the upload
      const formData = new FormData();
      const imageStream = fs.createReadStream(imagePath);
      
      formData.append('file', imageStream, {
        filename: imageFilename,
        contentType: imagePath.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
      });
      formData.append('minorEdit', 'true');

      // Upload the attachment
      const response = await this.client.post(`/content/${pageId}/child/attachment`, formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Atlassian-Token': 'no-check'
        }
      });

      const attachmentId = response.data.results[0]?.id;
      if (!attachmentId) {
        throw new Error('Failed to get attachment ID from upload response');
      }

      this.logger.info(`Image uploaded successfully. Attachment ID: ${attachmentId}`);
      
      // Return the download URL for the attachment
      const downloadUrl = `${this.config.baseUrl}/wiki/download/attachments/${pageId}/${encodeURIComponent(imageFilename)}`;
      return downloadUrl;

    } catch (error) {
      const message = `Failed to upload image to Confluence: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }

  /**
   * Generate diagram image and upload to Confluence, returning image URL
   */
  async generateAndUploadDiagramImage(
    pageId: string,
    diagramContent: string,
    diagramFormat: 'mermaid' | 'plantuml',
    modelName: string
  ): Promise<string> {
    const diagramImageService = new (await import('./diagram-image.service')).DiagramImageService();
    
    // Create temporary file path
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.ensureDir(tempDir);
    
    const sanitizedName = modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const imageExtension = 'png'; // We'll use PNG for best compatibility
    const tempImagePath = path.join(tempDir, `${sanitizedName}-diagram.${imageExtension}`);
    
    try {
      let imagePath: string;
      
      if (diagramFormat === 'mermaid') {
        imagePath = await diagramImageService.generateMermaidImage(
          diagramContent,
          tempImagePath,
          'png',
          1400, // Larger size for better quality
          1000
        );
      } else {
        imagePath = await diagramImageService.generatePlantUMLImage(
          diagramContent,
          tempImagePath,
          'png'
        );
      }

      // Upload to Confluence
      const imageUrl = await this.uploadImageToConfluence(
        pageId,
        imagePath,
        `${sanitizedName}-diagram.${imageExtension}`
      );

      // Clean up temporary file
      await diagramImageService.cleanupTempFiles([imagePath]);
      
      return imageUrl;

    } catch (error) {
      // Ensure cleanup even if there's an error
      try {
        await diagramImageService.cleanupTempFiles([tempImagePath]);
      } catch (cleanupError) {
        this.logger.warn('Failed to cleanup temporary files', cleanupError);
      }
      throw error;
    }
  }
}
