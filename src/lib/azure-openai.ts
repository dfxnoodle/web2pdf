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
  documentType: 'academic' | 'business' | 'newsletter' | 'report' | 'article';
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
  async improveTypesetting(request: TypesettingRequest): Promise<TypesettingResponse> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback typesetting');
      return this.createFallbackTypesetting(request);
    }

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
        max_tokens: 4000,
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
    return `Improve the formatting of this ${request.documentType} content for ${request.outputFormat}:

${request.content}

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

  async generateContentStructure(rawContent: string): Promise<string> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback content structure');
      return this.createBasicStructure(rawContent);
    }

    try {
      const response = await client!.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: 'You are a content structure expert. Analyze unstructured content and create well-organized, hierarchical HTML structure with proper headings, sections, and semantic markup. IMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting, explanations, or text outside the JSON structure. Ensure all strings are properly escaped.'
          },
          {
            role: 'user',
            content: `Please structure this content with proper HTML semantics:\n\n${rawContent}`
          }
        ],
        max_tokens: 1500,
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
        throw new Error('Invalid JSON response from Azure OpenAI');
      }
    } catch (error) {
      console.error('Error generating content structure:', error);
      // Fallback to basic HTML structure
      return this.createBasicStructure(rawContent);
    }
  }

  private createBasicStructure(content: string): string {
    // Split content into paragraphs and create basic HTML structure
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    // Try to identify potential headings (lines that are shorter and appear to be titles)
    const structuredContent = paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      
      // Simple heuristic: if it's short and doesn't end with punctuation, it might be a heading
      if (trimmed.length < 100 && !trimmed.match(/[.!?]$/)) {
        return `<h2>${trimmed}</h2>`;
      } else {
        return `<p>${trimmed}</p>`;
      }
    });

    return `
      <article>
        <header>
          <h1>Document</h1>
        </header>
        <main>
          ${structuredContent.join('\n')}
        </main>
      </article>
    `;
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
}

export const azureOpenAIService = new AzureOpenAIService();
