import OpenAI from 'openai';

// Check if Azure OpenAI environment variables are available
const hasAzureConfig = !!(
  process.env.AZURE_OPENAI_API_KEY &&
  process.env.AZURE_OPENAI_ENDPOINT &&
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME
);

let client: OpenAI | null = null;

if (hasAzureConfig) {
  try {
    client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2025-01-01' },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });
    console.log('Azure OpenAI client initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Azure OpenAI client:', error);
    client = null;
  }
} else {
  console.warn('Azure OpenAI environment variables not found. Using fallback mode.');
}

export interface TypesettingRequest {
  content: string;
  documentType: 'academic' | 'business' | 'newsletter' | 'report' | 'article' | 'calendar';
  outputFormat: 'pdf' | 'html';
  styling?: {
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
}

export interface TypesettingResponse {
  formattedContent: string;
  styling: {
    css: string;
    layout: string;
  };
  suggestions: string[];
}

export class AzureOpenAIService {
  // Approximate token estimation (rough calculation: 1 token ≈ 4 characters)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Split content into chunks that fit within token limits
  private chunkContent(content: string, maxTokens: number = 7000): string[] {
    const estimatedTokens = this.estimateTokens(content);
    
    // If content is small enough, return as single chunk
    if (estimatedTokens <= maxTokens) {
      return [content];
    }

    const chunks: string[] = [];
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);
      
      // If adding this paragraph would exceed the limit, save current chunk and start new one
      if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
        currentTokens = paragraphTokens;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If no chunks were created (edge case), force split by character count
    if (chunks.length === 0) {
      const chunkSize = Math.floor(maxTokens * 3.5); // Conservative character limit
      for (let i = 0; i < content.length; i += chunkSize) {
        chunks.push(content.slice(i, i + chunkSize));
      }
    }

    console.log(`Content split into ${chunks.length} chunks for processing`);
    return chunks;
  }

  // Process content in chunks and combine results
  private async processContentInChunks<T>(
    content: string,
    processor: (chunk: string, isLast: boolean, chunkIndex: number) => Promise<T>,
    combiner: (results: T[]) => T,
    onProgress?: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<T> {
    const chunks = this.chunkContent(content);
    
    if (chunks.length === 1) {
      onProgress?.({ step: 'Processing content...', percentage: 50, chunkIndex: 1, totalChunks: 1 });
      const result = await processor(chunks[0], true, 0);
      onProgress?.({ step: 'Processing complete', percentage: 100, chunkIndex: 1, totalChunks: 1 });
      return result;
    }

    console.log(`Processing ${chunks.length} chunks...`);
    const results: T[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const progressPercentage = Math.round((i / chunks.length) * 80) + 10; // 10-90% range
      
      onProgress?.({ 
        step: `Processing chunk ${i + 1} of ${chunks.length}...`, 
        percentage: progressPercentage, 
        chunkIndex: i + 1, 
        totalChunks: chunks.length 
      });
      
      try {
        const result = await processor(chunks[i], isLast, i);
        results.push(result);
        console.log(`Processed chunk ${i + 1}/${chunks.length}`);
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        // Continue with other chunks, but log the error
      }
    }

    onProgress?.({ step: 'Combining results...', percentage: 95, chunkIndex: chunks.length, totalChunks: chunks.length });
    const finalResult = combiner(results);
    onProgress?.({ step: 'Processing complete', percentage: 100, chunkIndex: chunks.length, totalChunks: chunks.length });
    
    return finalResult;
  }

  async improveTypesetting(
    request: TypesettingRequest, 
    onProgress?: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<TypesettingResponse> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback typesetting');
      return this.createFallbackTypesetting(request);
    }

    // Use chunking for large content
    return await this.processContentInChunks(
      request.content,
      async (chunk: string, isLast: boolean, chunkIndex: number) => {
        const chunkRequest = { ...request, content: chunk };
        return await this.processTypesettingChunk(chunkRequest, chunkIndex, isLast);
      },
      (results: TypesettingResponse[]) => this.combineTypesettingResults(results),
      onProgress
    );
  }

  private async processTypesettingChunk(
    request: TypesettingRequest, 
    chunkIndex: number, 
    isLast: boolean
  ): Promise<TypesettingResponse> {

    try {
      const response = await client!.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: `You are an expert typesetter and document designer. Analyze content and provide optimal formatting, layout suggestions, and CSS styling for professional documents. Focus on readability, visual hierarchy, and print-friendly layouts. 

IMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting, explanations, or text outside the JSON structure. Ensure all strings are properly escaped.`
          },
          {
            role: 'user',
            content: this.createTypesettingPrompt(request)
          }
        ],
        max_tokens: 9999,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "TypesettingResponse",
            strict: true,
            schema: {
              type: "object",
              properties: {
                formattedContent: {
                  type: "string",
                  description: "Improved HTML content with semantic markup"
                },
                styling: {
                  type: "object",
                  properties: {
                    css: {
                      type: "string",
                      description: "Complete CSS styles for the document"
                    },
                    layout: {
                      type: "string",
                      description: "Layout description and recommendations"
                    }
                  },
                  required: ["css", "layout"],
                  additionalProperties: false
                },
                suggestions: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "List of improvement suggestions"
                }
              },
              required: ["formattedContent", "styling", "suggestions"],
              additionalProperties: false
            }
          }
        }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      // Clean and parse the JSON response
      try {
        const cleanedResult = this.cleanJsonResponse(result);
        return JSON.parse(cleanedResult) as TypesettingResponse;
      } catch (parseError) {
        console.error('Failed to parse Azure OpenAI response:', parseError);
        console.error('Raw response:', result);
        
        // Try to extract partial data if possible
        try {
          const partialMatch = result.match(/"formattedContent"\s*:\s*"([^"]+)"/);
          if (partialMatch) {
            console.log('Using partial response fallback');
            return {
              formattedContent: partialMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
              styling: {
                css: this.createBasicCSS(request),
                layout: 'Basic layout applied due to parsing error'
              },
              suggestions: ['Response parsing failed, using basic formatting']
            };
          }
        } catch (extractError) {
          console.error('Failed to extract partial data:', extractError);
        }
        
        // Final fallback
        throw new Error('Invalid JSON response from Azure OpenAI');
      }
    } catch (error) {
      console.error('Error calling Azure OpenAI:', error);
      // Fallback to basic typesetting when Azure OpenAI is not available
      return this.createFallbackTypesetting(request);
    }
  }

  private createFallbackTypesetting(request: TypesettingRequest): TypesettingResponse {
    // Create basic HTML structure from the content
    const paragraphs = request.content.split('\n\n').filter(p => p.trim());
    const htmlContent = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
    
    // Basic CSS based on document type
    let css = `
      body {
        font-family: ${request.styling?.fontFamily || "'Times New Roman', serif"};
        font-size: ${request.styling?.fontSize || 12}px;
        line-height: ${request.styling?.lineHeight || 1.6};
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: ${request.styling?.margins?.top || 20}px;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      
      h1 { font-size: 24px; }
      h2 { font-size: 20px; }
      h3 { font-size: 16px; }
      
      p {
        margin-bottom: 1em;
        text-align: justify;
      }
    `;

    if (request.documentType === 'academic') {
      css += `
        h1 { text-align: center; margin-bottom: 2em; }
        p { text-indent: 1.5em; }
      `;
    } else if (request.documentType === 'business') {
      css += `
        h1, h2 { color: #2c3e50; }
        p { margin-bottom: 1.2em; }
      `;
    } else if (request.documentType === 'calendar') {
      css += `
        h1 { text-align: center; color: #1e40af; margin-bottom: 1.5em; }
        h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5em; }
        table { width: 100%; border-collapse: collapse; margin: 1em 0; }
        th, td { border: 1px solid #d1d5db; padding: 0.5em; text-align: center; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .date { font-weight: bold; }
        .event { font-style: italic; color: #6b7280; }
      `;
    }

    return {
      formattedContent: htmlContent,
      styling: {
        css,
        layout: `Basic ${request.documentType} layout with proper typography`
      },
      suggestions: [
        'Basic formatting applied',
        'Consider customizing fonts and spacing for better appearance',
        'Azure OpenAI service unavailable - using fallback formatting'
      ]
    };
  }

  private createTypesettingPrompt(request: TypesettingRequest): string {
    let specificInstructions = '';
    
    if (request.documentType === 'calendar') {
      specificInstructions = `
For calendar documents, focus on:
- Clear date formatting with proper visual hierarchy
- Table layouts for calendar grids when appropriate
- Consistent spacing and alignment for events
- Color coding or visual distinction for different event types
- Professional typography suitable for scheduling content
- Easy-to-scan layout with clear date headers`;
    } else if (request.documentType === 'academic') {
      specificInstructions = `
For academic documents, focus on:
- Formal typography with proper citation styling
- Clear section hierarchies
- Professional margins and spacing
- Scientific notation and formula formatting when present`;
    } else if (request.documentType === 'business') {
      specificInstructions = `
For business documents, focus on:
- Corporate-style formatting
- Professional color scheme
- Clear headings and bullet points
- Executive summary styling when present`;
    }

    return `Improve the formatting of this ${request.documentType} content for ${request.outputFormat}:

${request.content}

${specificInstructions}

Please provide:
1. Enhanced HTML with proper semantic structure
2. Professional CSS styling for ${request.documentType} documents
3. Brief suggestions for improvement

Focus on readability and professional appearance. Keep CSS concise and avoid complex rules.`;
  }

  private parseTypesettingResponse(response: string): TypesettingResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback if JSON parsing fails
      return {
        formattedContent: response,
        styling: {
          css: '',
          layout: 'Standard layout recommended'
        },
        suggestions: ['Consider using the provided formatting improvements']
      };
    } catch (error) {
      console.error('Error parsing Azure OpenAI response:', error);
      return {
        formattedContent: response,
        styling: {
          css: '',
          layout: 'Default layout applied'
        },
        suggestions: ['Unable to parse formatting suggestions']
      };
    }
  }

  async generateContentStructure(
    rawContent: string,
    onProgress?: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<string> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback content structure');
      return this.createBasicStructure(rawContent);
    }

    // Use chunking for large content
    return await this.processContentInChunks(
      rawContent,
      async (chunk: string, isLast: boolean, chunkIndex: number) => {
        return await this.processContentStructureChunk(chunk, chunkIndex, isLast);
      },
      (results: string[]) => this.combineContentStructureResults(results),
      onProgress
    );
  }

  private async processContentStructureChunk(
    content: string, 
    chunkIndex: number, 
    isLast: boolean
  ): Promise<string> {
    try {
      const response = await client!.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: `You are a content structure expert. Analyze unstructured content and create well-organized, hierarchical HTML structure with proper headings, sections, and semantic markup. 

${chunkIndex > 0 ? 'This is a continuation of a larger document. Maintain consistent heading hierarchy and structure.' : ''}

IMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting, explanations, or text outside the JSON structure. Ensure all strings are properly escaped.`
          },
          {
            role: 'user',
            content: `Please structure this content with proper HTML semantics${chunkIndex > 0 ? ' (continuation of larger document)' : ''}:\n\n${content}`
          }
        ],
        max_tokens: 9999,
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ContentStructureResponse",
            strict: true,
            schema: {
              type: "object",
              properties: {
                structuredContent: {
                  type: "string",
                  description: "Well-structured HTML content with semantic markup"
                },
                title: {
                  type: "string",
                  description: "Extracted or generated title for the content"
                },
                summary: {
                  type: "string",
                  description: "Brief summary of the content structure"
                }
              },
              required: ["structuredContent", "title", "summary"],
              additionalProperties: false
            }
          }
        }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      // Clean and parse the JSON response
      try {
        const cleanedResult = this.cleanJsonResponse(result);
        const parsed = JSON.parse(cleanedResult);
        return parsed.structuredContent;
      } catch (parseError) {
        console.error('Failed to parse content structure response:', parseError);
        console.error('Raw response:', result);
        
        // Fallback to basic structure for this chunk
        return this.createBasicStructure(content);
      }
    } catch (error) {
      console.error('Error generating content structure for chunk:', error);
      // Fallback to basic HTML structure for this chunk
      return this.createBasicStructure(content);
    }
  }

  private combineTypesettingResults(results: TypesettingResponse[]): TypesettingResponse {
    if (results.length === 0) {
      throw new Error('No typesetting results to combine');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Combine all formatted content
    const combinedContent = results.map(result => result.formattedContent).join('\n\n');
    
    // Use the CSS from the first result (they should be similar for same document type)
    const primaryStyling = results[0].styling;
    
    // Combine all suggestions and remove duplicates
    const allSuggestions = results.flatMap(result => result.suggestions);
    const uniqueSuggestions = [...new Set(allSuggestions)];
    
    // Add a note about chunked processing
    uniqueSuggestions.push(`Content was processed in ${results.length} chunks due to size`);

    return {
      formattedContent: combinedContent,
      styling: {
        css: primaryStyling.css,
        layout: `${primaryStyling.layout} (processed in ${results.length} chunks)`
      },
      suggestions: uniqueSuggestions
    };
  }

  private combineContentStructureResults(results: string[]): string {
    if (results.length === 0) {
      return '<p>No content processed</p>';
    }

    if (results.length === 1) {
      return results[0];
    }

    // Extract content from each structured result and combine
    const combinedContent = results.map((result, index) => {
      // Remove wrapping article/header/main tags if they exist, keep the inner content
      let content = result;
      
      // Extract main content, removing outer wrappers
      const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/);
      if (mainMatch) {
        content = mainMatch[1].trim();
      } else {
        // If no main tag, remove article and header wrappers
        content = content
          .replace(/<\/?article[^>]*>/g, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/g, '')
          .replace(/<\/?main[^>]*>/g, '')
          .trim();
      }

      return content;
    }).filter(content => content.length > 0);

    // Wrap the combined content in a proper structure
    return `
      <article>
        <header>
          <h1>Document</h1>
        </header>
        <main>
          ${combinedContent.join('\n\n')}
        </main>
      </article>
    `.trim();
  }

  private cleanJsonResponse(response: string): string {
    try {
      // Remove any markdown code block markers
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleaned = cleaned.trim();
      
      // If the response doesn't start with {, try to find the JSON part
      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
      }
      
      // Check if JSON is truncated (doesn't end with })
      if (!cleaned.endsWith('}')) {
        console.warn('JSON response appears to be truncated');
        // Try to find the last complete property and close the JSON
        const lastCompleteProperty = cleaned.lastIndexOf('",');
        if (lastCompleteProperty > -1) {
          cleaned = cleaned.substring(0, lastCompleteProperty + 1) + '}}';
        } else {
          // If we can't fix it, throw an error
          throw new Error('Truncated JSON response cannot be repaired');
        }
      }
      
      // Fix common escape issues in JSON strings
      cleaned = cleaned.replace(/\n/g, '\\n');
      cleaned = cleaned.replace(/\r/g, '\\r');
      cleaned = cleaned.replace(/\t/g, '\\t');
      
      return cleaned;
    } catch (error) {
      console.error('Error cleaning JSON response:', error);
      return response;
    }
  }

  private createBasicCSS(request: TypesettingRequest): string {
    return `
      body {
        font-family: ${request.styling?.fontFamily || "'Times New Roman', serif"};
        font-size: ${request.styling?.fontSize || 12}px;
        line-height: ${request.styling?.lineHeight || 1.6};
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: ${request.styling?.margins?.top || 20}px;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      
      h1 { font-size: 24px; }
      h2 { font-size: 20px; }
      h3 { font-size: 16px; }
      
      p {
        margin-bottom: 1em;
        text-align: justify;
      }
    `;
  }

  private createBasicStructure(content: string): string {
    // Create a basic HTML structure from raw content
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    // Try to identify potential headings (lines that are shorter and might be titles)
    const structuredContent = paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      
      // Simple heuristic for headings: short lines that don't end with punctuation
      if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?') && !trimmed.includes('\n')) {
        return `<h2>${trimmed}</h2>`;
      } else {
        return `<p>${trimmed}</p>`;
      }
    }).join('\n');

    return `
      <article>
        <header>
          <h1>Document</h1>
        </header>
        <main>
          ${structuredContent}
        </main>
      </article>
    `.trim();
  }
}

export const azureOpenAIService = new AzureOpenAIService();
