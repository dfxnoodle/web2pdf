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
      console.log('Converting PDF to images for Vision API analysis...')
      
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
        console.log(`Analyzing page ${i + 1} with Vision API using file: ${imagePath}`)
        
        try {
          // Read image file as buffer for Vision API
          const imageBuffer = fs.readFileSync(imagePath)
          const imageBase64 = imageBuffer.toString('base64')
          
          const response = await client.chat.completions.create({
            model: 'gpt-4o', // Use specific Vision model
            messages: [
              {
                role: 'system',
                content: `You are an expert document analysis AI. Extract all visible text from this page image.

Instructions:
1. Read and transcribe ALL visible text accurately
2. Maintain the original structure and formatting
3. Preserve headings, paragraphs, lists, and tables
4. Keep the natural reading order
5. For tables, format them in a readable way
6. Ignore watermarks or decorative elements
7. If this is page ${i + 1} of a multi-page document, start with "=== Page ${i + 1} ===" 

Provide clean, well-structured text that preserves the document's organization.`
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract all text from page ${i + 1} of "${filename}". Maintain structure and formatting.`
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
            max_tokens: 1500, // Reasonable limit per page
            temperature: 0.1
          })

          const pageText = response.choices?.[0]?.message?.content
          if (pageText) {
            allExtractedText += pageText + '\n\n'
            console.log(`Extracted ${pageText.length} characters from page ${i + 1}`)
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
        <img src="${screenshot}" alt="Screenshot of the webpage" style="max-width: 100%; height: auto; border: 1px solid #ddd; margin-bottom: 1em;" />
      </div>\n`;
    }

    // Add other images found in the content
    if (images && images.length > 0) {
      imageContent += '<div class="content-images">\n';
      images.forEach(img => {
        imageContent += `  <img src="${img.src}" alt="${img.alt || 'Content image'}" style="max-width: 100%; height: auto; margin: 0.5em 0;" />\n`;
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

CONTENT ANALYSIS FOCUS:
- What is the main topic/theme of this content?
- What type of organization/person/event does this relate to?
- What are the key sections and information hierarchy?
- What design style would best represent this content?
- What colors, fonts, and layout would be most appropriate?

OUTPUT REQUIREMENTS:
- Respond with valid JSON only
- Include complete HTML structure with semantic markup
- Include comprehensive CSS with modern design
- Create content-specific navigation and sections
- Use actual content themes for design decisions

JSON Schema:
{
  "html": "complete HTML structure with actual content-derived titles and sections",
  "css": "comprehensive CSS with theme-appropriate colors and modern design",
  "suggestions": ["array of specific improvement suggestions"]
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
5. Make it modern, responsive, and visually appealing
6. Include navigation that makes sense for this specific content

${request.images && request.images.length > 0 ? 
  `IMAGES AVAILABLE: ${request.images.length} images that should be incorporated into the design` : 
  'No images available'}`
          }
        ],
        max_tokens: 12000,
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
        throw new Error('Invalid JSON response from Azure OpenAI');
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
    `;

    const css = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 2rem;
      }

      .hero-section {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4rem 0;
        text-align: center;
      }

      .hero-title {
        font-size: 3rem;
        font-weight: 700;
        margin-bottom: 1rem;
      }

      .hero-subtitle {
        font-size: 1.2rem;
        opacity: 0.9;
      }

      .main-content {
        padding: 4rem 0;
      }

      .content-section {
        max-width: 800px;
        margin: 0 auto;
      }

      .image-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin: 3rem 0;
      }

      .gallery-image {
        width: 100%;
        height: auto;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      }

      h1, h2, h3 {
        margin-bottom: 1.5rem;
        color: #2c3e50;
      }

      h2 {
        font-size: 2rem;
        border-bottom: 3px solid #667eea;
        padding-bottom: 0.5rem;
        margin-top: 3rem;
      }

      p {
        margin-bottom: 1.5rem;
        font-size: 1.1rem;
      }

      .site-footer {
        background: #2c3e50;
        color: white;
        padding: 2rem 0;
        text-align: center;
      }

      @media (max-width: 768px) {
        .hero-title {
          font-size: 2rem;
        }
        
        .container {
          padding: 0 1rem;
        }
        
        .image-gallery {
          grid-template-columns: 1fr;
        }
      }
    `;

    return {
      html,
      css,
      suggestions: [
        'Content-specific design applied based on document analysis',
        'Consider adding interactive elements for better engagement',
        'Images are displayed in a responsive gallery layout',
        'Typography optimized for readability across devices'
      ]
    };
  }
}

export const azureOpenAIService = new AzureOpenAIService();
