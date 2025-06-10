import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, options = {} } = await request.json();
    
    const {
      format = 'a4',
      orientation = 'portrait',
      margin = { top: 20, right: 20, bottom: 20, left: 20 }
    } = options;

    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Check if htmlContent is already a full HTML document
    const isFullDocument = htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html');
    
    let fullHtml;
    if (isFullDocument) {
      // Use the provided HTML as-is since it's already a complete document
      fullHtml = htmlContent;
    } else {
      // Wrap content in basic HTML structure
      fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: 'Times New Roman', serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                font-size: 12px;
              }
              h1 { font-size: 24px; margin-bottom: 16px; font-weight: bold; page-break-after: avoid; }
              h2 { font-size: 20px; margin-bottom: 12px; font-weight: bold; page-break-after: avoid; }
              h3 { font-size: 18px; margin-bottom: 10px; font-weight: bold; page-break-after: avoid; }
              p { margin-bottom: 12px; text-align: justify; }
              ul, ol { margin-bottom: 12px; padding-left: 20px; }
              li { margin-bottom: 6px; }
              
              /* Hide interactive elements */
              .button, button, input, textarea, select { display: none !important; }
              
              /* Print-specific styles */
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;
    }
    
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: format.toUpperCase() as any,
      landscape: orientation === 'landscape',
      margin: {
        top: `${margin.top}mm`,
        right: `${margin.right}mm`,
        bottom: `${margin.bottom}mm`,
        left: `${margin.left}mm`,
      },
      printBackground: true,
      preferCSSPageSize: true,
    });
    
    await browser.close();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating PDF with Puppeteer:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
