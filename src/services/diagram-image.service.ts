import puppeteer from 'puppeteer';
import { Logger } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';

/**
 * Service for generating diagram images from Mermaid/PlantUML code
 * Creates PNG/SVG files that can be uploaded to Confluence
 */
export class DiagramImageService {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Generate image from Mermaid diagram code
   */
  async generateMermaidImage(
    diagramCode: string,
    outputPath: string,
    format: 'png' | 'svg' = 'png',
    width: number = 1200,
    height: number = 800
  ): Promise<string> {
    try {
      this.logger.info(`Generating Mermaid ${format.toUpperCase()} image: ${outputPath}`);

      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));

      // Create HTML template with Mermaid
      const htmlContent = this.createMermaidHtml(diagramCode, width, height);
      
      // Launch puppeteer browser
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        
        // Set viewport size
        await page.setViewport({ width, height });
        
        // Set the HTML content
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Wait for Mermaid to render completely
        await page.waitForFunction(
          () => (globalThis as any).mermaidRenderComplete === true,
          { timeout: 15000 }
        );
        
        // Check if there was a rendering error
        const renderError = await page.evaluate(() => (globalThis as any).mermaidRenderError);
        if (renderError) {
          throw new Error(`Mermaid rendering failed: ${renderError.message || renderError}`);
        }
        
        // Get the SVG element
        const svgElement = await page.$('#mermaid-diagram svg');
        
        if (!svgElement) {
          throw new Error('Failed to find rendered Mermaid diagram');
        }

        if (format === 'svg') {
          // Get SVG content
          const svgContent = await page.evaluate(() => {
            const svg = (globalThis as any).document.querySelector('#mermaid-diagram svg');
            return svg ? svg.outerHTML : null;
          });
          
          if (!svgContent) {
            throw new Error('Failed to extract SVG content');
          }
          
          await fs.writeFile(outputPath, svgContent, 'utf-8');
        } else {
          // Take screenshot of the SVG element
          await svgElement.screenshot({
            path: outputPath as `${string}.png`,
            type: 'png',
            omitBackground: true
          });
        }

        this.logger.info(`Mermaid ${format.toUpperCase()} image generated successfully: ${outputPath}`);
        return outputPath;

      } finally {
        await browser.close();
      }

    } catch (error) {
      const message = `Failed to generate Mermaid image: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }

  /**
   * Generate image from PlantUML diagram code
   * Note: This requires a PlantUML server or local installation
   */
  async generatePlantUMLImage(
    diagramCode: string,
    outputPath: string,
    format: 'png' | 'svg' = 'png'
  ): Promise<string> {
    try {
      this.logger.info(`Generating PlantUML ${format.toUpperCase()} image: ${outputPath}`);

      // For now, we'll use the PlantUML online server
      // In production, you might want to run your own PlantUML server
      const encodedDiagram = this.encodePlantUML(diagramCode);
      const imageUrl = `http://www.plantuml.com/plantuml/${format}/${encodedDiagram}`;

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`PlantUML server returned ${response.status}: ${response.statusText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      
      // Ensure output directory exists
      await fs.ensureDir(path.dirname(outputPath));
      
      // Save the image
      await fs.writeFile(outputPath, Buffer.from(imageBuffer));

      this.logger.info(`PlantUML ${format.toUpperCase()} image generated successfully: ${outputPath}`);
      return outputPath;

    } catch (error) {
      const message = `Failed to generate PlantUML image: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(message, error);
      throw new Error(message);
    }
  }

  /**
   * Create enhanced HTML template for Mermaid rendering with comprehensive SIVI AFD 2.0 CSS styling
   */
  private createMermaidHtml(diagramCode: string, width: number, height: number): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SIVI AFD 2.0 Domain Model</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.7.0/dist/mermaid.esm.min.mjs';
    
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#000000',
        lineColor: '#333333',
        classText: '#000000'
      },
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      classDiagram: {
        useMaxWidth: true,
        htmlLabels: true
      }
    });

    document.addEventListener('DOMContentLoaded', async function() {
      try {
        const diagramCode = \`${diagramCode.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
        const element = document.getElementById('mermaid-diagram');
        
        element.innerHTML = '';
        
        const { svg, bindFunctions } = await mermaid.render('sivi-domain-model', diagramCode);
        element.innerHTML = svg;
        
        if (bindFunctions) {
          bindFunctions(element);
        }
        
        const svgElement = element.querySelector('svg');
        if (svgElement) {
          svgElement.setAttribute('data-sivi-compliant', 'AFD-2.0');
          svgElement.setAttribute('data-generated', new Date().toISOString());
        }
        
        window.mermaidRenderComplete = true;
        
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        const element = document.getElementById('mermaid-diagram');
        element.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + error.message + '</div>';
        window.mermaidRenderComplete = true;
        window.mermaidRenderError = error;
      }
    });
  </script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      background: white;
    }
    #mermaid-diagram {
      width: ${width}px;
      height: ${height}px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #mermaid-diagram svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <div id="mermaid-diagram">
    <div>Loading SIVI AFD 2.0 diagram...</div>
  </div>
</body>
</html>`;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SIVI AFD 2.0 Domain Model</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.7.0/dist/mermaid.esm.min.mjs';
    
    // Enhanced Mermaid configuration for SIVI models
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#000000',
        primaryBorderColor: '#000000',
        lineColor: '#333333',
        classText: '#000000',
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '14px'
      },
      securityLevel: 'loose',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      fontSize: '14px',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      },
      classDiagram: {
        useMaxWidth: false,
        htmlLabels: true
      }
    });

    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', async function() {
      try {
        const diagramCode = \`${diagramCode.replace(/`/g, '\\`')}\`;
        const element = document.getElementById('mermaid-diagram');
        
        // Clear any existing content
        element.innerHTML = '';
        
        // Render the diagram using Mermaid 11.x API
        const { svg, bindFunctions } = await mermaid.render('sivi-domain-model', diagramCode);
        element.innerHTML = svg;
        
        // Bind any interactive functions if needed
        if (bindFunctions) {
          bindFunctions(element);
        }
        
        // Apply additional SIVI-specific styling
        const svgElement = element.querySelector('svg');
        if (svgElement) {
          // Add SIVI branding and metadata
          svgElement.setAttribute('data-sivi-compliant', 'AFD-2.0');
          svgElement.setAttribute('data-generated', new Date().toISOString());
          
          // Enhance SVG styling with comprehensive CSS
          const style = document.createElement('style');
          style.textContent = \`
            /* SIVI AFD 2.0 Enhanced Entity Styling */
            .policyClass rect { 
              fill: #e1f5fe !important; 
              stroke: #01579b !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .coverageClass rect { 
              fill: #f3e5f5 !important; 
              stroke: #4a148c !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .partyClass rect { 
              fill: #e8f5e8 !important; 
              stroke: #1b5e20 !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .claimClass rect { 
              fill: #fff3e0 !important; 
              stroke: #e65100 !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .premiumClass rect { 
              fill: #fff8e1 !important; 
              stroke: #f57c00 !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .objectClass rect { 
              fill: #f1f8e9 !important; 
              stroke: #33691e !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            .clauseClass rect { 
              fill: #fce4ec !important; 
              stroke: #ad1457 !important; 
              stroke-width: 3px !important;
              filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.1));
            }
            
            /* Text styling enhancements */
            .classTitle {
              font-weight: bold !important;
              font-size: 16px !important;
              fill: #000000 !important;
            }
            
            .classText {
              font-family: 'Segoe UI', sans-serif !important;
              font-size: 12px !important;
              fill: #000000 !important;
            }
            
            /* Relationship line styling */
            .relation {
              stroke: #333333 !important;
              stroke-width: 2px !important;
            }
            
            .relationshipLabel {
              font-size: 11px !important;
              fill: #555555 !important;
              font-style: italic;
            }
            
            /* SIVI compliance badge styling */
            .note rect {
              fill: #f8f9fa !important;
              stroke: #6c757d !important;
              stroke-width: 1px !important;
            }
            
            .note text {
              font-family: 'Segoe UI', sans-serif !important;
              font-size: 11px !important;
              fill: #495057 !important;
            }
            
            /* Enhanced visual effects */
            .node rect {
              border-radius: 4px;
            }
            
            /* Hover effects for interactivity */
            .node:hover rect {
              stroke-width: 4px !important;
              filter: drop-shadow(3px 3px 6px rgba(0,0,0,0.2)) !important;
            }
          \`;
          
          svgElement.appendChild(style);
        }
        
        // Signal that rendering is complete
        window.mermaidRenderComplete = true;
        
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        document.getElementById('mermaid-diagram').innerHTML = 
          '<div style="color: red; padding: 20px;">Error rendering diagram: ' + error.message + '</div>';
        window.mermaidRenderComplete = true;
        window.mermaidRenderError = error;
      }
    });
  </script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
    }
    #mermaid-diagram {
      width: ${width}px;
      height: ${height}px;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #fafafa;
    }
    #mermaid-diagram svg {
      max-width: 100%;
      max-height: 100%;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="mermaid-diagram">
    <div style="color: #666; font-size: 14px;">Generating SIVI AFD 2.0 Domain Model...</div>
  </div>
</body>
</html>`;
  }

  /**
   * Encode PlantUML diagram for URL
   * Basic implementation - you might want to use a proper PlantUML encoder
   */
  private encodePlantUML(diagramCode: string): string {
    // Simple base64 encoding for demonstration
    // In production, use proper PlantUML text encoding
    return Buffer.from(diagramCode).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          this.logger.debug(`Cleaned up temporary file: ${filePath}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup file ${filePath}:`, error);
      }
    }
  }

  /**
   * Generate SVG from Mermaid code (for debugging)
   */
  async generateSVG(mermaidCode: string, width: number = 1400, height: number = 1000): Promise<string> {
    const browser = await puppeteer.launch({ headless: true });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height });

      // Debug: Log the Mermaid code
      console.log('=== Generated Mermaid Code ===');
      console.log(mermaidCode);
      console.log('=== End Mermaid Code ===');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
        </head>
        <body>
          <div id="mermaid">${mermaidCode}</div>
          <script>
            mermaid.initialize({ 
              startOnLoad: true,
              theme: 'default',
              logLevel: 'error',
              securityLevel: 'loose'
            });
          </script>
        </body>
        </html>
      `;
      
      await page.setContent(html);
      
      // Wait for mermaid to render
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get the SVG content
      const svgElement = await page.$('#mermaid svg');
      if (!svgElement) {
        throw new Error('No SVG element found after Mermaid rendering');
      }
      
      const svgContent = await page.evaluate((element) => element.outerHTML, svgElement);
      
      return svgContent;
    } finally {
      await browser.close();
    }
  }
}
