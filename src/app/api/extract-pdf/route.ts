import { NextRequest, NextResponse } from 'next/server'
import { azureOpenAIService } from '@/lib/azure-openai'

// Fallback content generator
function generateFallbackContent(filename: string, fileSize: number): string {
  return `# ${filename.replace('.pdf', '')}

## Document Analysis

This PDF document (${Math.round(fileSize / 1024)} KB) could not be processed using OpenAI Vision API.

## Content Overview

The document appears to contain:
- Formatted text content
- Possible images or graphics
- Structured information layout
- Professional document formatting

## Processing Options

To extract content from this document, consider:
1. Ensuring the PDF contains selectable text
2. Converting to image format first
3. Using alternative PDF processing tools
4. Manual content input for key information

## Ready for Website Generation

This document can still serve as a foundation for creating a modern website. The AI can help structure and format any manually provided content.

*Note: OpenAI Vision API is the primary method for PDF content extraction and image description. For best results, ensure the PDF has clear, readable text and properly visible images.*`
}

export async function POST(request: NextRequest) {
  try {
    // Check if Vision API is available
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
      return NextResponse.json(
        { error: 'Azure OpenAI configuration is missing. Vision API requires proper Azure OpenAI setup.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const pdfFile = formData.get('pdf') as File

    if (!pdfFile) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    console.log('Processing PDF file with OpenAI Vision:', pdfFile.name, 'Size:', buffer.length, 'bytes')
    
    let cleanedText = ''
    let pageCount = 1
    let imageDescriptions: Array<{id: string, description: string, page: number}> = []
    
    try {
      // Use Azure OpenAI Vision API service to extract content
      const result = await azureOpenAIService.analyzePdfWithVision(buffer, pdfFile.name)
      cleanedText = result.text
      pageCount = result.pageCount
      imageDescriptions = result.imageDescriptions || []
      console.log('Successfully extracted content and image descriptions using Azure OpenAI Vision API service')
      console.log(`Found ${imageDescriptions.length} image descriptions`)
    } catch (visionError) {
      console.error('Vision API extraction failed:', visionError)
      // Use fallback content generation
      cleanedText = generateFallbackContent(pdfFile.name, buffer.length)
      pageCount = 1
      imageDescriptions = []
      console.log('Using fallback content due to Vision API failure')
    }
    
    // Clean the text
    cleanedText = cleanedText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
    
    // Limit content length for processing
    if (cleanedText.length > 10000) {
      cleanedText = cleanedText.substring(0, 10000) + '\n\n[Content truncated for processing - full document analysis available]'
    }
    
    if (!cleanedText || cleanedText.length < 20) {
      cleanedText = generateFallbackContent(pdfFile.name, buffer.length)
    }
    
    console.log('Final processed text length:', cleanedText.length)
    console.log('Final text preview:', cleanedText.substring(0, 200))
    console.log('Image descriptions:', imageDescriptions)

    return NextResponse.json({
      content: cleanedText,
      images: imageDescriptions, // Return the extracted image descriptions
      metadata: {
        pages: pageCount,
        size: buffer.length,
        filename: pdfFile.name,
        extractionMethod: 'OpenAI Vision API with Separate Image Descriptions',
        features: ['text_extraction', 'image_descriptions', 'structure_preservation'],
        imageCount: imageDescriptions.length
      }
    })

  } catch (error) {
    console.error('Error extracting PDF content:', error)
    return NextResponse.json(
      { error: 'Failed to extract PDF content using Vision API: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
