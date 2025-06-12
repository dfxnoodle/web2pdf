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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const page = await browser.newPage();
    
    // Set up request interception to handle image CORS issues
    await page.setRequestInterception(true);
    
    page.on('request', async (req) => {
      if (req.resourceType() === 'image') {
        const imageUrl = req.url();
        
        // Check if it's an external image that might have CORS issues
        if (imageUrl.startsWith('http') && !imageUrl.includes(request.nextUrl.hostname)) {
          try {
            // Fetch image server-side to avoid CORS
            const response = await fetch(imageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PDF Generator)',
                'Accept': 'image/*',
              },
              signal: AbortSignal.timeout(10000),
            });
            
            if (response.ok) {
              const imageBuffer = await response.arrayBuffer();
              const contentType = response.headers.get('content-type') || 'image/png';
              
              req.respond({
                status: 200,
                contentType,
                body: Buffer.from(imageBuffer),
              });
            } else {
              req.continue();
            }
          } catch {
            req.continue();
          }
        } else {
          req.continue();
        }
      } else {
        req.continue();
      }
    });
    
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
              
              /* Image styling for PDF */
              img {
                max-width: 100% !important;
                height: auto !important;
                display: block;
                margin: 1em auto;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                page-break-inside: avoid;
              }
              
              /* Removed webpage-screenshot styles since screenshots are for AI reference only
              .webpage-screenshot img {
                max-width: 90%;
                margin: 1.5em auto;
                border: 2px solid #333;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
              }
              */
              
              .content-images {
                margin: 1em 0;
                text-align: center;
              }
              
              .content-images img {
                margin: 0.5em auto;
                max-width: 80%;
                display: inline-block;
              }
              
              /* Removed data URL styles since screenshots should not be in PDF content
              img[src^="data:"] {
                max-width: 95% !important;
                border: 2px solid #666;
              }
              */
              
              /* Ensure images don't break across pages */
              figure, .image-container {
                page-break-inside: avoid;
                margin: 1em 0;
              }
              
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
