import { Injectable } from '@angular/core';
import { marked } from 'marked';
import hljs from 'highlight.js';

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  constructor() {
    this.configureMarked();
  }

  private configureMarked(): void {
    marked.setOptions({
      gfm: true,
      breaks: true
    });

    // Custom renderer for syntax highlighting
    const renderer = new marked.Renderer();

    renderer.code = (code: string, language: string | undefined): string => {
      const validLanguage = language && hljs.getLanguage(language) ? language : 'plaintext';
      const highlighted = hljs.highlight(code, { language: validLanguage }).value;
      return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
    };

    marked.use({ renderer });
  }

  parse(markdown: string): string {
    try {
      return marked.parse(markdown) as string;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return '<p>Error parsing markdown</p>';
    }
  }

  // Get line mapping for sync scroll
  getLineMapping(markdown: string): Map<number, number> {
    const lines = markdown.split('\n');
    const mapping = new Map<number, number>();
    let htmlLineEstimate = 0;

    lines.forEach((line, index) => {
      mapping.set(index, htmlLineEstimate);

      // Estimate HTML lines based on content
      if (line.startsWith('#')) {
        htmlLineEstimate += 2; // Headers take more space
      } else if (line.startsWith('```')) {
        htmlLineEstimate += 1;
      } else if (line.trim() === '') {
        htmlLineEstimate += 1;
      } else {
        htmlLineEstimate += 1;
      }
    });

    return mapping;
  }
}
