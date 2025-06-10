import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const { content, websiteType, images } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    console.log('PDF Analysis - WebsiteType:', websiteType, 'Images count:', images?.length || 0);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Content Analysis
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Analyzing PDF content structure and layout...",
            percentage: 25,
            chunkIndex: 1,
            totalChunks: 4
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 2: Content Organization
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Organizing content into semantic sections...",
            percentage: 50,
            chunkIndex: 2,
            totalChunks: 4
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1500));

          // Step 3: Website Structure Planning
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Planning website structure and navigation...",
            percentage: 75,
            chunkIndex: 3,
            totalChunks: 4
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 4: Generate structured content using existing service
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Processing content with AI for optimal web presentation...",
            percentage: 90,
            chunkIndex: 4,
            totalChunks: 4
          })}\n\n`));

          // Use the existing content structure method
          const structuredContent = await azureOpenAIService.generateContentStructure(content);

          // Final step
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Analysis complete!",
            percentage: 100,
            chunkIndex: 4,
            totalChunks: 4
          })}\n\n`));

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            result: structuredContent
          })}\n\n`));

        } catch (error) {
          console.error('Error in PDF analysis:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to analyze PDF content: ' + (error as Error).message
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in PDF analysis endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
