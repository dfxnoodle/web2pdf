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
  images?: Array<{src: string, alt: string}>; // Add image support
  screenshot?: string; // Add screenshot support
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

// Add new interfaces for refinement functionality
export interface RefinementRequest {
  currentContent: string;
  currentCSS?: string;
  userFeedback: string;
  contentType: 'pdf' | 'website';
  documentType?: 'academic' | 'business' | 'newsletter' | 'report' | 'article' | 'calendar';
  websiteType?: 'landing' | 'blog' | 'portfolio' | 'documentation' | 'business' | 'personal';
  images?: Array<{data?: string, src?: string, type?: string, alt?: string, description?: string}>;
  originalRequest?: any; // Store original generation parameters
}

export interface RefinementResponse {
  refinedContent: string;
  refinedCSS?: string;
  changes: string[];
  suggestions: string[];
  explanation: string;
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

    // Add image handling instructions
    let imageInstructions = '';
    if (request.images && request.images.length > 0) {
      imageInstructions += `\n\nImages to include in the document:\n`;
      request.images.forEach((img, index) => {
        imageInstructions += `${index + 1}. ${img.src} (${img.alt || 'No description'})\n`;
      });
      imageInstructions += '\nInstructions for images:\n- Use server-side image processing to avoid CORS issues\n- Include images with proper styling and captions\n- Ensure images are responsive and print-friendly\n- Position images contextually within the content';
    }

    if (request.screenshot) {
      imageInstructions += '\n\nA webpage screenshot is available. Include it prominently as a visual representation of the source page.';
    }

    return `Improve the formatting of this ${request.documentType} content for ${request.outputFormat}:

${request.content}

${specificInstructions}

${imageInstructions}

Please provide:
1. Enhanced HTML with proper semantic structure and embedded images
2. Professional CSS styling for ${request.documentType} documents with image support
3. Brief suggestions for improvement

Focus on readability and professional appearance. Keep CSS concise and avoid complex rules. For images, use URLs directly - the PDF generation will handle them server-side.`;
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
    images?: Array<{src: string, alt: string}>,
    screenshot?: string,
    onProgress?: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<string> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback content structure');
      return this.createBasicStructure(rawContent, images, screenshot);
    }

    // Use chunking for large content
    return await this.processContentInChunks(
      rawContent,
      async (chunk: string, isLast: boolean, chunkIndex: number) => {
        return await this.processContentStructureChunk(chunk, chunkIndex, isLast, images, screenshot);
      },
      (results: string[]) => this.combineContentStructureResults(results),
      onProgress
    );
  }

  private async processContentStructureChunk(
    content: string, 
    chunkIndex: number, 
    isLast: boolean,
    images?: Array<{src: string, alt: string}>,
    screenshot?: string
  ): Promise<string> {
    try {
      // Build the prompt with image information
      let imageContext = '';
      if (images && images.length > 0) {
        imageContext += '\n\nImages found in the content:\n';
        images.forEach((img, index) => {
          imageContext += `${index + 1}. ${img.src} (Alt: ${img.alt || 'No description'})\n`;
        });
        imageContext += '\nPlease include these images in appropriate places within the structured content using <img> tags with the original URLs.';
      }
      
      if (screenshot) {
        imageContext += '\n\nA screenshot of the webpage is available. You can reference it as the main page visual. Include it at the beginning of the content as a representative image of the webpage.';
      }

      const response = await client!.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: `You are a content structure expert. Analyze unstructured content and create well-organized, hierarchical HTML structure with proper headings, sections, and semantic markup. 

${chunkIndex > 0 ? 'This is a continuation of a larger document. Maintain consistent heading hierarchy and structure.' : ''}

When including images:
- Use the exact image URLs provided
- Place images contextually where they make sense in the content
- Include proper alt attributes for accessibility
- Use responsive image styling

IMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting, explanations, or text outside the JSON structure. Ensure all strings are properly escaped.`
          },
          {
            role: 'user',
            content: `Please structure this content with proper HTML semantics${chunkIndex > 0 ? ' (continuation of larger document)' : ''}:\n\n${content}${imageContext}`
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

  // OpenAI Vision API for PDF content extraction using image files
  async analyzePdfWithVision(buffer: Buffer, filename: string): Promise<{text: string, pageCount: number}> {
    if (!client || !hasAzureConfig) {
      throw new Error('Azure OpenAI not configured for Vision API')
    }

    try {
      console.log('Converting PDF to images for Vision API analysis with image descriptions...')
      
      // Convert PDF to images using pdf2pic
      const pdf2pic = (await import('pdf2pic')).default
      const fs = await import('fs')
      const path = await import('path')
      const os = await import('os')
      
      // Create temporary directory for images
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-vision-'))
      const tempPdfPath = path.join(tempDir, 'temp.pdf')
      
      // Write buffer to temporary file
      fs.writeFileSync(tempPdfPath, buffer)
      
      // Convert PDF to images (limit to first 3 pages to avoid token limits)
      const convert = pdf2pic.fromPath(tempPdfPath, {
        density: 150, // DPI for good quality
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 1024, // Reasonable width to balance quality and file size
        height: 1400 // Reasonable height for typical document pages
      })
      
      // Convert up to 3 pages to avoid token limits
      const maxPages = 3
      let convertedPages: string[] = []
      
      try {
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          try {
            const result = await convert(pageNum, { responseType: 'image' })
            if (result && result.path) {
              convertedPages.push(result.path)
              console.log(`Converted page ${pageNum} to: ${result.path}`)
            }
          } catch (pageError) {
            // Page might not exist, stop here
            console.log(`Converted ${pageNum - 1} pages from PDF`)
            break
          }
        }
      } catch (conversionError) {
        console.error('PDF conversion error:', conversionError)
        throw new Error('Failed to convert PDF to images')
      }
      
      if (convertedPages.length === 0) {
        throw new Error('No pages could be converted from PDF')
      }
      
      console.log(`Converted ${convertedPages.length} pages to images`)
      
      // Analyze each page with Vision API using image files directly
      let allExtractedText = ''
      
      for (let i = 0; i < convertedPages.length; i++) {
        const imagePath = convertedPages[i]
        console.log(`Analyzing page ${i + 1} with Vision API for text and image descriptions using file: ${imagePath}`)
        
        try {
          // Read image file as buffer for Vision API
          const imageBuffer = fs.readFileSync(imagePath)
          const imageBase64 = imageBuffer.toString('base64')
          
          const response = await client.chat.completions.create({
            model: 'gpt-4o', // Use specific Vision model
            messages: [
              {
                role: 'system',
                content: `You are an expert document analysis AI. Extract all visible text from this page image and describe any visual elements.

Instructions:
1. Read and transcribe ALL visible text accurately
2. Maintain the original structure and formatting
3. Preserve headings, paragraphs, lists, and tables
4. Keep the natural reading order
5. For tables, format them in a readable way
6. Ignore watermarks or decorative elements
7. If this is page ${i + 1} of a multi-page document, start with "=== Page ${i + 1} ===" 
8. **IMPORTANT**: Describe any images, charts, diagrams, graphs, or visual elements present
9. For images/visuals, include descriptions like: "[IMAGE: Description of what is shown in the image]"
10. For charts/graphs, describe the type and key data points: "[CHART: Bar chart showing sales data for Q1-Q4]"
11. For diagrams, explain what they illustrate: "[DIAGRAM: Flow chart showing the process steps]"

Provide clean, well-structured text that preserves the document's organization and includes descriptions of all visual content that would help in website generation.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract all text and describe all visual elements from page ${i + 1} of "${filename}". Include detailed descriptions of images, charts, diagrams, and other visual content that would be useful for creating a website.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${imageBase64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 2000, // Increased limit to accommodate image descriptions
            temperature: 0.1
          })

          const pageText = response.choices?.[0]?.message?.content
          if (pageText) {
            allExtractedText += pageText + '\n\n'
            console.log(`Extracted ${pageText.length} characters (text + image descriptions) from page ${i + 1}`)
          }
        } catch (pageError) {
          console.error(`Error analyzing page ${i + 1}:`, pageError)
          allExtractedText += `\n=== Page ${i + 1} (Analysis Failed) ===\n[Content could not be extracted from this page]\n\n`
        }
      }
      
      // Clean up temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary files:', cleanupError)
      }
      
      if (!allExtractedText.trim()) {
        throw new Error('No content extracted from any pages')
      }

      console.log(`Total extracted text length: ${allExtractedText.length} characters`)
      
      return {
        text: allExtractedText.trim(),
        pageCount: convertedPages.length
      }
    } catch (error) {
      console.error('Vision API analysis failed:', error)
      throw new Error(`Vision API extraction failed: ${(error as Error).message}`)
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
      // First, validate the original response to understand what we're dealing with
      const validation = this.validateJsonResponse(response);
      if (validation.isValid) {
        return response; // Response is already valid JSON
      }

      console.warn('JSON response validation failed:', validation.error);
      if (validation.suggestion) {
        console.warn('Suggestion:', validation.suggestion);
      }

      // Remove any markdown code block markers
      let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Remove any leading/trailing whitespace
      cleaned = cleaned.trim();
      
      // If the response doesn't start with {, try to find the JSON part
      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        } else {
          throw new Error('No valid JSON object found in response');
        }
      }
      
      // Handle truncated JSON more robustly
      if (!cleaned.endsWith('}')) {
        console.warn('JSON response appears to be truncated, attempting repair...');
        cleaned = this.repairTruncatedJson(cleaned);
      }
      
      // Try to parse and fix common string escaping issues
      const finalValidation = this.validateJsonResponse(cleaned);
      if (!finalValidation.isValid) {
        console.warn('Attempting string sanitization...');
        cleaned = this.sanitizeJsonStrings(cleaned);
      }
      
      // Final validation
      const lastValidation = this.validateJsonResponse(cleaned);
      if (!lastValidation.isValid) {
        throw new Error(`Unable to repair JSON: ${lastValidation.error}`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('Error cleaning JSON response:', error);
      console.error('Original response length:', response.length);
      console.error('Response preview:', response.substring(0, 500) + '...');
      throw new Error(`JSON cleaning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private repairTruncatedJson(json: string): string {
    // Try to find the last complete string value and properly close the JSON
    // Look for patterns like: "key": "value", or "key": ["value"], or "key": {...}
    const patterns = [
      /("[^"]*":\s*"[^"]*"),?\s*$/,  // String property
      /("[^"]*":\s*\[[^\]]*\]),?\s*$/,  // Array property
      /("[^"]*":\s*\{[^}]*\}),?\s*$/,  // Object property
      /("[^"]*":\s*[^,}\]]*),?\s*$/   // Other values
    ];
    
    let repaired = false;
    let cleaned = json;
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const lastCompleteIndex = cleaned.lastIndexOf(match[1]);
        if (lastCompleteIndex > -1) {
          cleaned = cleaned.substring(0, lastCompleteIndex + match[1].length);
          // Count opening braces to determine how many closing braces we need
          const openBraces = (cleaned.match(/\{/g) || []).length;
          const closeBraces = (cleaned.match(/\}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          cleaned += '}' + '}'.repeat(Math.max(0, missingBraces - 1));
          repaired = true;
          break;
        }
      }
    }
    
    if (!repaired) {
      throw new Error('Truncated JSON response cannot be repaired automatically');
    }
    
    return cleaned;
  }

  private sanitizeJsonStrings(json: string): string {
    // More sophisticated string sanitization that preserves JSON structure
    return json.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
      if (content) {
        // Only escape if not already escaped and preserve existing escapes
        const fixed = content
          .replace(/(?<!\\)\n/g, '\\n')
          .replace(/(?<!\\)\r/g, '\\r')
          .replace(/(?<!\\)\t/g, '\\t')
          .replace(/(?<!\\)"/g, '\\"')
          .replace(/(?<!\\)\\/g, '\\\\'); // Escape lone backslashes
        return `"${fixed}"`;
      }
      return match;
    });
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

  private createBasicStructure(content: string, images?: Array<{src: string, alt: string}>, screenshot?: string): string {
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

    // Add screenshot at the beginning if available
    let imageContent = '';
    if (screenshot) {
      imageContent += `<div class="webpage-screenshot">
        <img src="${screenshot}" alt="Screenshot of the webpage" style="max-width: 100%; height: auto; border: 1px solid #ddd; margin-bottom: 1em; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
      </div>\n`;
    }

    // Add other images found in the content
    if (images && images.length > 0) {
      imageContent += '<div class="content-images" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 1.5rem 0;">\n';
      images.forEach(img => {
        imageContent += `  <img src="${img.src}" alt="${img.alt || 'Content image'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); object-fit: cover;" />\n`;
      });
      imageContent += '</div>\n';
    }

    return `
      <article>
        <header>
          <h1>Document</h1>
        </header>
        <main>
          ${imageContent}
          ${structuredContent}
        </main>
      </article>
    `.trim();
  }

  // Creative website generation using AI to analyze content and create unique designs
  async generateCreativeWebsite(request: {
    content: string;
    websiteType: string;
    images?: Array<{data: string, type: string, description?: string}>;
    styling?: any;
  }): Promise<{html: string, css: string, suggestions: string[]}> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback website generation');
      return this.createFallbackWebsite(request);
    }

    // Check if content is too large and should be chunked
    if (this.shouldUseChunking(request.content)) {
      console.log('Content too large, using chunking approach for website generation');
      // For very large content, we'll need to chunk it and create a website based on the summary
      const chunks = this.chunkContent(request.content, 8000); // Smaller chunks for website generation
      
      // Generate a summary of the content first
      try {
        const summaryResponse = await client!.chat.completions.create({
          model: 'model-router',
          messages: [{
            role: 'user',
            content: `Please summarize this content in 500-800 words, focusing on the main themes, key points, and overall purpose:\n\n${chunks[0]}\n\n${chunks.length > 1 ? '[Content continues with additional sections...]' : ''}`
          }],
          max_tokens: 1000,
          temperature: 0.2
        });

        const summary = summaryResponse.choices[0]?.message?.content || 'Content analysis unavailable';
        
        // Create website based on summary
        const summarizedRequest = {
          ...request,
          content: summary + '\n\n[Note: This website is based on a summary of larger content]'
        };
        
        return this.generateCreativeWebsite(summarizedRequest);
      } catch (error) {
        console.error('Error generating summary for large content:', error);
        return this.createFallbackWebsite(request);
      }
    }

    try {
      const response = await client.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: `You are an expert web designer and content analyst. Your task is to analyze the provided content and create a beautiful, unique website that reflects the actual content, theme, and purpose of the document.

IMPORTANT INSTRUCTIONS:
1. Analyze the content to understand its theme, purpose, and key elements
2. Extract meaningful titles, headings, and structure from the actual content
3. Create a website design that matches the content's tone and purpose
4. DO NOT use generic titles like "Generated Website" or "Generated from PDF"
5. Use actual content to create meaningful headers, navigation, and sections
6. Design should be modern, responsive, and creative
7. Color scheme and styling should match the content's theme and purpose

RESPONSIVE DESIGN REQUIREMENTS:
- Use CSS Grid and Flexbox for layout
- Implement mobile-first design approach
- Include multiple breakpoints (mobile: 320px+, tablet: 768px+, desktop: 1024px+)
- Ensure text is readable on all screen sizes (minimum 16px on mobile)
- Make navigation collapsible/hamburger menu on mobile
- Optimize images for different screen sizes
- Use relative units (rem, em, %, vw, vh) instead of fixed pixels where appropriate
- Ensure touch-friendly tap targets (minimum 44px)
- Test layout at common breakpoints

MODERN CSS FEATURES TO USE:
- CSS Grid for main layout structure
- Flexbox for component layouts
- CSS Custom Properties (variables) for consistent theming
- Modern responsive typography with clamp()
- Smooth animations and transitions
- Box shadows and modern visual effects
- Responsive images with object-fit

CONTENT ANALYSIS FOCUS:
- What is the main topic/theme of this content?
- What type of organization/person/event does this relate to?
- What are the key sections and information hierarchy?
- What design style would best represent this content?
- What colors, fonts, and layout would be most appropriate?

OUTPUT REQUIREMENTS:
- Respond with valid JSON only
- Include complete HTML structure with semantic markup and responsive meta tags
- Include comprehensive CSS with mobile-first responsive design
- Create content-specific navigation and sections
- Use actual content themes for design decisions
- Implement at least 3 breakpoints for optimal responsive behavior

JSON Schema:
{
  "html": "complete HTML structure with actual content-derived titles, semantic markup, and responsive meta tags",
  "css": "comprehensive CSS with mobile-first responsive design, CSS Grid, Flexbox, and modern features",
  "suggestions": ["array of specific improvement suggestions including responsive enhancements"]
}`
          },
          {
            role: 'user',
            content: `Analyze this content and create a unique, creative website that reflects its actual theme and purpose:

CONTENT TO ANALYZE:
${request.content}

WEBSITE TYPE: ${request.websiteType}

REQUIREMENTS:
1. Extract the main theme/topic from the content
2. Create appropriate titles and headers based on actual content
3. Design a color scheme that matches the content's theme
4. Structure the website logically based on the content hierarchy
5. Make it modern, responsive, and visually appealing with mobile-first design
6. Include navigation that makes sense for this specific content
7. Implement responsive breakpoints for mobile, tablet, and desktop
8. Use modern CSS features like Grid, Flexbox, and Custom Properties
9. Ensure accessibility with proper semantic HTML and ARIA attributes
10. Include responsive typography that scales well across devices

RESPONSIVE DESIGN FOCUS:
- Mobile viewport: 320px-767px (single column, large touch targets)
- Tablet viewport: 768px-1023px (flexible layouts, readable text)
- Desktop viewport: 1024px+ (multi-column, advanced layouts)
- Use clamp() for fluid typography
- Implement proper image optimization and responsive loading

${request.images && request.images.length > 0 ? 
  `IMAGES AVAILABLE: ${request.images.length} images that should be incorporated into the design` : 
  'No images available'}`
          }
        ],
        max_tokens: this.calculateOptimalMaxTokens(request.content, 'creative'),
        temperature: 0.3,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "CreativeWebsiteResponse",
            strict: true,
            schema: {
              type: "object",
              properties: {
                html: {
                  type: "string",
                  description: "Complete HTML structure with content-specific design"
                },
                css: {
                  type: "string", 
                  description: "Comprehensive CSS with theme-appropriate styling"
                },
                suggestions: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Specific improvement suggestions for this content"
                }
              },
              required: ["html", "css", "suggestions"],
              additionalProperties: false
            }
          }
        }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      try {
        const cleanedResult = this.cleanJsonResponse(result);
        const parsed = JSON.parse(cleanedResult);
        
        // Process images if available
        let processedHtml = parsed.html;
        if (request.images && request.images.length > 0) {
          request.images.forEach((image, index) => {
            const placeholder = `[IMAGE_${index + 1}]`;
            const imgTag = `<img src="data:${image.type};base64,${image.data}" alt="${image.description || `Image ${index + 1}`}" class="content-image">`;
            processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), imgTag);
          });
        }
        
        return {
          html: processedHtml,
          css: parsed.css,
          suggestions: parsed.suggestions
        };
      } catch (parseError) {
        console.error('Failed to parse creative website response:', parseError);
        console.error('Raw response length:', result.length);
        console.error('Raw response preview:', result.substring(0, 1000));
        
        // Try to extract partial data using regex patterns
        try {
          const htmlMatch = result.match(/"html"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const cssMatch = result.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          
          if (htmlMatch && cssMatch) {
            console.log('Using regex-extracted partial response');
            return {
              html: htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t'),
              css: cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t'),
              suggestions: ['Response parsing failed, using regex extraction fallback']
            };
          }
        } catch (extractError) {
          console.error('Failed to extract partial data with regex:', extractError);
        }
        
        // Final fallback - return fallback website
        console.log('Using complete fallback website generation');
        return this.createFallbackWebsite(request);
      }
    } catch (error) {
      console.error('Error generating creative website:', error);
      // Fallback to basic website generation
      return this.createFallbackWebsite(request);
    }
  }

  private createFallbackWebsite(request: {
    content: string;
    websiteType: string;
    images?: Array<{data: string, type: string, description?: string}>;
  }): {html: string, css: string, suggestions: string[]} {
    // Analyze content to extract a meaningful title
    const lines = request.content.split('\n').filter(line => line.trim());
    const firstLine = lines[0] || 'Document';
    
    // Try to find a meaningful title from the content
    let title = 'Document';
    if (firstLine.length < 100 && firstLine.length > 5) {
      title = firstLine.replace(/[=#\*\-]/g, '').trim();
    }
    
    // Extract key sections
    const sections = request.content.split('\n\n').filter(section => section.trim());
    const structuredContent = sections.map(section => {
      const trimmed = section.trim();
      if (trimmed.length < 100 && !trimmed.endsWith('.')) {
        return `<h2>${trimmed}</h2>`;
      } else {
        return `<p>${trimmed}</p>`;
      }
    }).join('\n');

    // Include images
    let imageContent = '';
    if (request.images && request.images.length > 0) {
      imageContent = '<div class="image-gallery">';
      request.images.forEach((image, index) => {
        imageContent += `<img src="data:${image.type};base64,${image.data}" alt="${image.description || `Image ${index + 1}`}" class="gallery-image">`;
      });
      imageContent += '</div>';
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="${title} - Content-driven responsive website">
        <title>${title}</title>
      </head>
      <body>
        <div class="website-container">
          <header class="hero-section">
            <div class="container">
              <h1 class="hero-title">${title}</h1>
              <p class="hero-subtitle">Discover the content within</p>
            </div>
          </header>
          <main class="main-content">
            <div class="container">
              ${imageContent}
              <div class="content-section">
                ${structuredContent}
              </div>
            </div>
          </main>
          <footer class="site-footer">
            <div class="container">
              <p>Crafted with care</p>
            </div>
          </footer>
        </div>
      </body>
      </html>
    `;

    const css = `
      /* CSS Custom Properties for consistent theming */
      :root {
        --primary-color: #667eea;
        --secondary-color: #764ba2;
        --text-color: #333;
        --background-color: #ffffff;
        --hero-text-color: #ffffff;
        --footer-bg: #2c3e50;
        --border-radius: 12px;
        --shadow: 0 8px 24px rgba(0,0,0,0.1);
        --transition: all 0.3s ease;
      }

      /* Reset and base styles */
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html {
        font-size: 16px; /* Base font size for rem calculations */
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        line-height: 1.6;
        color: var(--text-color);
        background-color: var(--background-color);
      }

      /* Container with responsive padding */
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }

      /* Hero section with responsive design */
      .hero-section {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        color: var(--hero-text-color);
        padding: clamp(2rem, 8vw, 6rem) 0;
        text-align: center;
      }

      .hero-title {
        font-size: clamp(1.75rem, 5vw, 3rem);
        font-weight: 700;
        margin-bottom: 1rem;
        line-height: 1.2;
      }

      .hero-subtitle {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        opacity: 0.9;
        max-width: 600px;
        margin: 0 auto;
      }

      /* Main content with responsive spacing */
      .main-content {
        padding: clamp(2rem, 6vw, 4rem) 0;
      }

      .content-section {
        max-width: 800px;
        margin: 0 auto;
      }

      /* Responsive image gallery using CSS Grid */
      .image-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: clamp(1rem, 3vw, 2rem);
        margin: clamp(2rem, 5vw, 3rem) 0;
      }

      .gallery-image {
        width: 100%;
        height: auto;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow);
        transition: var(--transition);
        object-fit: cover;
      }

      .gallery-image:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      }

      /* Typography with responsive sizing */
      h1, h2, h3 {
        margin-bottom: 1.5rem;
        color: var(--text-color);
        line-height: 1.3;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 2.5rem);
      }

      h2 {
        font-size: clamp(1.5rem, 3vw, 2rem);
        border-bottom: 3px solid var(--primary-color);
        padding-bottom: 0.5rem;
        margin-top: clamp(2rem, 4vw, 3rem);
      }

      h3 {
        font-size: clamp(1.25rem, 2.5vw, 1.5rem);
      }

      p {
        margin-bottom: 1.5rem;
        font-size: clamp(1rem, 2vw, 1.1rem);
        max-width: 65ch; /* Optimal reading length */
      }

      /* Footer with responsive design */
      .site-footer {
        background: var(--footer-bg);
        color: var(--hero-text-color);
        padding: clamp(1.5rem, 3vw, 2rem) 0;
        text-align: center;
      }

      /* Responsive breakpoints for specific adjustments */
      @media (max-width: 768px) {
        .container {
          padding: 0 1rem;
        }
        
        .image-gallery {
          grid-template-columns: 1fr;
        }
        
        .hero-section {
          padding: 3rem 0;
        }
        
        .main-content {
          padding: 2rem 0;
        }
      }

      @media (max-width: 480px) {
        .container {
          padding: 0 0.75rem;
        }
        
        .hero-title {
          font-size: 1.75rem;
        }
        
        .hero-subtitle {
          font-size: 1rem;
        }
      }

      @media (min-width: 1024px) {
        .container {
          padding: 0 2rem;
        }
        
        .image-gallery {
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        }
      }

      /* Print styles for better printing */
      @media print {
        .hero-section {
          background: none;
          color: var(--text-color);
        }
        
        .gallery-image {
          box-shadow: none;
          border: 1px solid #ddd;
        }
        
        .site-footer {
          background: none;
          color: var(--text-color);
          border-top: 1px solid #ddd;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        :root {
          --primary-color: #0066cc;
          --secondary-color: #004499;
          --text-color: #000;
          --background-color: #fff;
        }
      }

      /* Reduced motion for accessibility */
      @media (prefers-reduced-motion: reduce) {
        .gallery-image {
          transition: none;
        }
        
        .gallery-image:hover {
          transform: none;
        }
      }
    `;

    return {
      html,
      css,
      suggestions: [
        'Mobile-first responsive design implemented with CSS Grid and Flexbox',
        'Modern CSS features used: Custom Properties, clamp(), responsive units',
        'Content-specific design applied based on document analysis',
        'Accessibility features: proper contrast, reduced motion support, semantic HTML',
        'Images optimized with responsive grid layout and hover effects',
        'Typography scales smoothly across all device sizes',
        'Touch-friendly interface with appropriate tap targets',
        'Print styles included for better document printing'
      ]
    };
  }

  async refineContent(
    request: RefinementRequest,
    onProgress?: (progress: { step: string; percentage: number }) => void
  ): Promise<RefinementResponse> {
    // Check if Azure OpenAI is available
    if (!client || !hasAzureConfig) {
      console.log('Azure OpenAI not available, using fallback refinement');
      return this.createFallbackRefinement(request);
    }

    // Use chunking for large content
    return await this.processContentInChunks(
      request.currentContent,
      async (chunk: string, isLast: boolean, chunkIndex: number) => {
        const chunkRequest = { ...request, currentContent: chunk };
        return await this.processRefinementChunk(chunkRequest, chunkIndex, isLast);
      },
      (results: RefinementResponse[]) => this.combineRefinementResults(results),
      onProgress
    );
  }

  private async processRefinementChunk(
    request: RefinementRequest,
    chunkIndex: number,
    isLast: boolean
  ): Promise<RefinementResponse> {
    try {
      const response = await client!.chat.completions.create({
        model: 'model-router',
        messages: [
          {
            role: 'system',
            content: `You are an expert content editor and designer specializing in ${request.contentType} refinement. Your task is to analyze user feedback and apply precise improvements to the content and styling.

IMPORTANT: You must respond with valid JSON only. Do not include any markdown formatting, explanations, or text outside the JSON structure. Ensure all strings are properly escaped.

USER FEEDBACK ANALYSIS:
- Carefully read and understand the user's specific requests
- Identify what aspects they want to change (layout, styling, content organization, etc.)
- Apply changes that directly address their concerns
- Maintain the overall quality and professionalism of the document
- Preserve good elements while improving the requested areas

REFINEMENT PRINCIPLES:
- Make targeted improvements based on user feedback
- Maintain consistency with the document type and purpose
- Ensure accessibility and readability are preserved or enhanced
- Provide clear explanations of what was changed and why
- Suggest additional improvements that complement the user's requests

For ${request.contentType === 'pdf' ? 'PDF documents' : 'websites'}, focus on:
${request.contentType === 'pdf' ? 
  '- Typography and formatting improvements\n- Layout optimization for print\n- Professional document structure\n- Clear hierarchy and readability' :
  '- Modern responsive design\n- User experience improvements\n- Visual appeal and engagement\n- Mobile-first optimization'
}`
          },
          {
            role: 'user',
            content: this.createRefinementPrompt(request)
          }
        ],
        max_tokens: this.calculateOptimalMaxTokens(request.currentContent, 'refinement'),
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "RefinementResponse",
            strict: true,
            schema: {
              type: "object",
              properties: {
                refinedContent: {
                  type: "string",
                  description: "Improved content with user feedback applied"
                },
                refinedCSS: {
                  type: "string",
                  description: "Updated CSS styles if applicable"
                },
                changes: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "List of specific changes made"
                },
                suggestions: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Additional improvement suggestions"
                },
                explanation: {
                  type: "string",
                  description: "Explanation of changes made and rationale"
                }
              },
              required: ["refinedContent", "refinedCSS", "changes", "suggestions", "explanation"],
              additionalProperties: false
            }
          }
        }
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from Azure OpenAI');
      }

      try {
        const cleanedResult = this.cleanJsonResponse(result);
        const parsed = JSON.parse(cleanedResult) as RefinementResponse;
        
        // Ensure refinedCSS is included if not provided but currentCSS exists
        if (!parsed.refinedCSS && request.currentCSS) {
          parsed.refinedCSS = request.currentCSS;
        }
        
        return parsed;
      } catch (parseError) {
        console.error('Failed to parse refinement response:', parseError);
        console.error('Raw response length:', result.length);
        console.error('Raw response preview:', result.substring(0, 1000));
        
        // Try to extract partial data using regex patterns for refinement
        try {
          const contentMatch = result.match(/"refinedContent"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const cssMatch = result.match(/"refinedCSS"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const changesMatch = result.match(/"changes"\s*:\s*\[((?:[^\]\\]|\\.)*)\]/);
          
          if (contentMatch) {
            console.log('Using regex-extracted partial refinement response');
            const extractedContent = contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
            
            return {
              refinedContent: extractedContent,
              refinedCSS: cssMatch ? cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t') : (request.currentCSS || ''),
              changes: changesMatch ? ['Partial changes applied from truncated response'] : ['Response parsing failed, minimal changes applied'],
              suggestions: ['Response parsing failed, using regex extraction fallback'],
              explanation: 'Response was partially parsed due to truncation or formatting issues'
            } as RefinementResponse;
          }
        } catch (extractError) {
          console.error('Failed to extract partial refinement data with regex:', extractError);
        }
        
        // Final fallback
        console.log('Using complete fallback refinement');
        return this.createFallbackRefinement(request);
      }
    } catch (error) {
      console.error('Error calling Azure OpenAI for refinement:', error);
      return this.createFallbackRefinement(request);
    }
  }

  private createRefinementPrompt(request: RefinementRequest): string {
    let prompt = `Please refine this ${request.contentType} based on the user's feedback:

CURRENT CONTENT:
${request.currentContent}

${request.currentCSS ? `CURRENT CSS STYLES:
${request.currentCSS}

` : ''}USER FEEDBACK:
${request.userFeedback}

CONTEXT:
- Content Type: ${request.contentType}
- Document Type: ${request.documentType || request.websiteType || 'general'}
- Original Purpose: ${request.contentType === 'pdf' ? 'Professional document formatting' : 'Modern responsive website'}

REFINEMENT REQUIREMENTS:
1. Address each point in the user's feedback specifically
2. Maintain or improve the overall quality and structure
3. Ensure the content remains appropriate for its intended use
4. Apply modern ${request.contentType === 'pdf' ? 'typographic' : 'web design'} best practices
5. Preserve accessibility and readability standards

Please provide:
1. Refined content with improvements applied
2. ${request.currentCSS ? 'Updated CSS styles that implement the requested changes' : 'CSS styles if applicable'}
3. A detailed list of changes made
4. Additional suggestions for further improvement
5. Clear explanation of the refinement rationale`;

    // Add image context if available
    if (request.images && request.images.length > 0) {
      prompt += `\n\nIMAGES CONTEXT:
The content includes ${request.images.length} image(s). Please ensure any layout changes accommodate these images appropriately.`;
    }

    return prompt;
  }

  private combineRefinementResults(results: RefinementResponse[]): RefinementResponse {
    if (results.length === 0) {
      throw new Error('No refinement results to combine');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Combine all refined content
    const combinedContent = results.map(result => result.refinedContent).join('\n\n');
    
    // Use the CSS from the first result (they should be similar)
    const primaryCSS = results[0].refinedCSS;
    
    // Combine all changes and remove duplicates
    const allChanges = results.flatMap(result => result.changes);
    const uniqueChanges = [...new Set(allChanges)];
    
    // Combine all suggestions and remove duplicates
    const allSuggestions = results.flatMap(result => result.suggestions);
    const uniqueSuggestions = [...new Set(allSuggestions)];
    
    // Create a combined explanation
    const explanation = `Applied user feedback across ${results.length} content sections. ${results[0].explanation}`;

    return {
      refinedContent: combinedContent,
      refinedCSS: primaryCSS,
      changes: uniqueChanges,
      suggestions: uniqueSuggestions,
      explanation
    };
  }

  private createFallbackRefinement(request: RefinementRequest): RefinementResponse {
    // Basic fallback refinement when Azure OpenAI is not available
    let refinedContent = request.currentContent;
    const changes: string[] = [];
    const suggestions: string[] = [];

    // Simple text processing based on common feedback patterns
    const feedback = request.userFeedback.toLowerCase();
    
    if (feedback.includes('font') || feedback.includes('text size')) {
      changes.push('Applied basic font size adjustments');
      if (request.currentCSS) {
        // Basic font size adjustment
        request.currentCSS = request.currentCSS.replace(/font-size:\s*\d+px/g, 'font-size: 14px');
      }
    }
    
    if (feedback.includes('color') || feedback.includes('background')) {
      changes.push('Applied basic color scheme adjustments');
    }
    
    if (feedback.includes('spacing') || feedback.includes('margin') || feedback.includes('padding')) {
      changes.push('Adjusted spacing and layout');
    }

    // Add basic suggestions
    suggestions.push(
      'Azure OpenAI service unavailable - using basic refinement',
      'For advanced refinements, please ensure AI service is properly configured',
      'Consider manual adjustments to achieve desired results'
    );

    return {
      refinedContent,
      refinedCSS: request.currentCSS,
      changes: changes.length > 0 ? changes : ['Applied basic improvements based on feedback'],
      suggestions,
      explanation: 'Basic refinement applied due to AI service unavailability. Manual review and adjustment may be needed for optimal results.'
    };
  }

  private validateJsonResponse(response: string): { isValid: boolean; error?: string; suggestion?: string } {
    try {
      JSON.parse(response);
      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Analyze the type of JSON error to provide better suggestions
      if (errorMessage.includes('Unexpected end of JSON input')) {
        return { 
          isValid: false, 
          error: 'JSON response was truncated', 
          suggestion: 'Response likely exceeded token limit, try reducing content size or using chunking' 
        };
      } else if (errorMessage.includes('Unexpected token') || errorMessage.includes('Unexpected non-whitespace')) {
        return { 
          isValid: false, 
          error: 'JSON contains invalid characters or formatting', 
          suggestion: 'Response may contain unescaped characters or mixed content types' 
        };
      } else if (errorMessage.includes('Expected property name')) {
        return { 
          isValid: false, 
          error: 'JSON structure is malformed', 
          suggestion: 'Response may have been corrupted or partially generated' 
        };
      } else {
        return { 
          isValid: false, 
          error: errorMessage, 
          suggestion: 'Check response format and content' 
        };
      }
    }
  }

  private sanitizeJsonString(str: string): string {
    // Escape characters that commonly cause JSON parsing issues
    return str
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')    // Escape quotes
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '\\r')   // Escape carriage returns
      .replace(/\t/g, '\\t')   // Escape tabs
      .replace(/\f/g, '\\f')   // Escape form feeds
      .replace(/\b/g, '\\b');  // Escape backspaces
  }

  private calculateOptimalMaxTokens(inputContent: string, requestType: 'creative' | 'refinement' = 'creative'): number {
    const inputTokens = this.estimateTokens(inputContent);
    const systemPromptTokens = 1000; // Approximate system prompt size
    const bufferTokens = 500; // Safety buffer
    
    // Azure OpenAI GPT-4 model has context limit of ~128k tokens
    const contextLimit = 120000; // Leave some buffer
    const baseOutputTokens = requestType === 'creative' ? 8000 : 6000;
    
    // Calculate available tokens for output
    const availableTokens = contextLimit - inputTokens - systemPromptTokens - bufferTokens;
    
    // Ensure we don't exceed reasonable limits but also don't go too low
    const maxTokens = Math.min(
      Math.max(baseOutputTokens, availableTokens * 0.6), // Use 60% of available space
      16000 // Cap at 16k tokens for output
    );
    
    console.log(`Token calculation: input=${inputTokens}, available=${availableTokens}, max_tokens=${maxTokens}`);
    
    return Math.floor(maxTokens);
  }

  private shouldUseChunking(content: string): boolean {
    const tokens = this.estimateTokens(content);
    const threshold = 50000; // If content is over 50k tokens, use chunking
    return tokens > threshold;
  }
}

export const azureOpenAIService = new AzureOpenAIService();
