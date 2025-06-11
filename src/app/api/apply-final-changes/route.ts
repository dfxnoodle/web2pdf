import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService, RefinementRequest } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const requestData: RefinementRequest = await request.json();

    // Validate required fields
    if (!requestData.currentContent || !requestData.userFeedback || !requestData.contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: currentContent, userFeedback, contentType' },
        { status: 400 }
      );
    }

    // Validate content type
    if (!['pdf', 'website'].includes(requestData.contentType)) {
      return NextResponse.json(
        { error: 'contentType must be either "pdf" or "website"' },
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

        // Process refinement with progress updates
        azureOpenAIService.refineContent(requestData, onProgress)
          .then((refinementResult) => {
            // Send final result
            const finalData = `data: ${JSON.stringify({ 
              type: 'complete', 
              result: refinementResult,
              step: 'Content refinement complete',
              percentage: 100 
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
            controller.close();
          })
          .catch((error) => {
            console.error('Error in content refinement:', error);
            const errorData = `data: ${JSON.stringify({ 
              type: 'error', 
              error: error.message || 'Unknown error occurred during refinement',
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
    console.error('Error in apply-final-changes API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}