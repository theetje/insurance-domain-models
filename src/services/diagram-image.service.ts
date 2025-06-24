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
        
        // Wait for Mermaid to render
        await page.waitForSelector('#mermaid-diagram svg', { timeout: 10000 });
        
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
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
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
  </style>
</head>
<body>
  <div id="mermaid-diagram">
    <div class="mermaid">
${diagramCode}
    </div>
  </div>
  
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      },
      classDiagram: {
        useMaxWidth: true
      }
    });
  </script>
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
}
