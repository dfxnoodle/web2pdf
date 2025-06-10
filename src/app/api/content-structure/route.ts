import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const structuredContent = await azureOpenAIService.generateContentStructure(content);
    
    return NextResponse.json({ structuredContent });
  } catch (error) {
    console.error('Error in content structure API:', error);
    return NextResponse.json(
      { error: 'Failed to generate content structure' },
      { status: 500 }
    );
  }
}
