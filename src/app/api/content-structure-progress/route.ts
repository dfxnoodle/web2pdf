import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const { content, documentType, images, screenshot } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Progress callback function
        const onProgress = (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => {
          const data = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        // Process content with progress updates, including images
        azureOpenAIService.generateContentStructure(content, images, screenshot, onProgress)
          .then((structuredContent) => {
            // Send final result
            const finalData = `data: ${JSON.stringify({ 
              type: 'complete', 
              structuredContent,
              step: 'Content structure generation complete',
              percentage: 100 
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
            controller.close();
          })
          .catch((error) => {
            console.error('Error in content structure generation:', error);
            const errorData = `data: ${JSON.stringify({ 
              type: 'error', 
              error: error.message || 'Unknown error occurred',
              step: 'Error occurred during processing',
              percentage: 0 
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error in content-structure-progress API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
