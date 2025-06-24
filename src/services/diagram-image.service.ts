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
   * Create HTML template for Mermaid rendering
   */
  private createMermaidHtml(diagramCode: string, width: number, height: number): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mermaid Diagram</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.7.0/dist/mermaid.esm.min.mjs';
    
    // Initialize mermaid with proper configuration for version 11.x
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      classDiagram: {
        useMaxWidth: true
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
        const { svg, bindFunctions } = await mermaid.render('generated-diagram', diagramCode);
        element.innerHTML = svg;
        
        // Bind any interactive functions if needed
        if (bindFunctions) {
          bindFunctions(element);
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
    <div>Loading diagram...</div>
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
