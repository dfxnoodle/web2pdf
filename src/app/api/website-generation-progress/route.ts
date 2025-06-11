import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const { content, websiteType, images, styling, imageDescriptions, specialRequirements } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    console.log('Website Generation - WebsiteType:', websiteType, 'Images count:', images?.length || 0, 'Image descriptions count:', imageDescriptions?.length || 0, 'Special requirements:', specialRequirements ? 'Yes' : 'No');

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: HTML Structure Generation
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Generating HTML structure and semantic markup...",
            percentage: 20,
            chunkIndex: 1,
            totalChunks: 5
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 2: CSS Styling
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Creating modern CSS styles and responsive design...",
            percentage: 40,
            chunkIndex: 2,
            totalChunks: 5
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1500));

          // Step 3: Interactive Elements
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Adding interactive elements and animations...",
            percentage: 60,
            chunkIndex: 3,
            totalChunks: 5
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 4: Responsive Optimization
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Optimizing for mobile and responsive design...",
            percentage: 80,
            chunkIndex: 4,
            totalChunks: 5
          })}\n\n`));

          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 5: AI Generation
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Analyzing content themes and generating creative website structure...",
            percentage: 90,
            chunkIndex: 5,
            totalChunks: 5
          })}\n\n`));

          // Create a comprehensive website generation request
          const websiteRequest = {
            content,
            websiteType,
            imageDescriptions: imageDescriptions || [],
            styling: styling || {},
            specialRequirements: specialRequirements
          };

          const websiteResult = await azureOpenAIService.generateCreativeWebsite(websiteRequest);

          const finalResult = {
            html: websiteResult.html,
            css: websiteResult.css,
            suggestions: websiteResult.suggestions || [
              'Content-specific design applied based on document analysis',
              imageDescriptions?.length > 0 ? `${imageDescriptions.length} images integrated with provided URLs` : 'Consider adding images for better visual appeal',
              'Consider adding interactive elements for better engagement',
              'Optimize images for web performance',
              'Consider implementing smooth scrolling navigation'
            ]
          };

          // Final step
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            step: "Website generation complete!",
            percentage: 100,
            chunkIndex: 5,
            totalChunks: 5
          })}\n\n`));

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            result: finalResult
          })}\n\n`));

        } catch (error) {
          console.error('Error in website generation:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: 'Failed to generate website: ' + (error as Error).message
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
    console.error('Error in website generation endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
