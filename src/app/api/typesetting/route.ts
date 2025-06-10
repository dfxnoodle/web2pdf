import { NextRequest, NextResponse } from 'next/server';
import { azureOpenAIService, TypesettingRequest } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    const body: TypesettingRequest = await request.json();
    
    // Validate required fields
    if (!body.content || !body.documentType || !body.outputFormat) {
      return NextResponse.json(
        { error: 'Missing required fields: content, documentType, outputFormat' },
        { status: 400 }
      );
    }

    const result = await azureOpenAIService.improveTypesetting(body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in typesetting API:', error);
    return NextResponse.json(
      { error: 'Failed to process typesetting request' },
      { status: 500 }
    );
  }
}
