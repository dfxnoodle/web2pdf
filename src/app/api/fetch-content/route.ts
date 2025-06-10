import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

export async function POST(request: NextRequest) {
  try {
    const { url, captureScreenshot = true } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch webpage: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    
    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .sidebar, .nav, .navigation, .menu, .ads, .advertisement, .social, .share, .comments').remove();
    
    // Extract title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled Document';
    
    // Extract meta description
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       '';
    
    // Extract main content - try multiple selectors for different site structures
    let content = '';
    
    // Try common content selectors
    const contentSelectors = [
      'main',
      'article',
      '.post-content',
      '.entry-content',
      '.content',
      '.article-content',
      '.post-body',
      '#content',
      '.main-content',
      'body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Get text content but preserve some structure
        content = element.html() || '';
        if (content.trim().length > 100) { // Only use if substantial content
          break;
        }
      }
    }
    
    // Clean up the HTML content
    const contentCheerio = cheerio.load(content);
    
    // Remove remaining unwanted elements
    contentCheerio('script, style, iframe, embed, object, applet, form, input, button, select, textarea').remove();
    
    // Get clean text while preserving some formatting
    const paragraphs: string[] = [];
    contentCheerio('p, h1, h2, h3, h4, h5, h6, li, div').each((_, element) => {
      const text = contentCheerio(element).text().trim();
      if (text && text.length > 10) { // Only include substantial text
        paragraphs.push(text);
      }
    });
    
    // If no structured content found, fall back to all text
    if (paragraphs.length === 0) {
      const bodyElement = contentCheerio('body');
      if (bodyElement.length > 0) {
        const fullText = bodyElement.text().trim();
        if (fullText) {
          // Split into paragraphs by line breaks
          paragraphs.push(...fullText.split(/\n\s*\n/).filter((p: string) => p.trim().length > 10));
        }
      }
    }
    
    const cleanContent = paragraphs.join('\n\n');
    
    // Extract images
    const images: Array<{src: string, alt: string}> = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      if (src) {
        // Convert relative URLs to absolute
        try {
          const imageUrl = new URL(src, url).href;
          images.push({ src: imageUrl, alt });
        } catch {
          // Skip invalid image URLs
        }
      }
    });

    // Capture webpage screenshot if requested
    let screenshotUrl = '';
    if (captureScreenshot) {
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        
        // Take screenshot
        const screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: false, // Capture viewport only for faster processing
          quality: 80 
        });
        
        await browser.close();
        
        // Convert screenshot to data URL for easy inclusion
        const screenshotBase64 = Buffer.from(screenshot).toString('base64');
        screenshotUrl = `data:image/png;base64,${screenshotBase64}`;
        
      } catch (screenshotError) {
        console.warn('Failed to capture screenshot:', screenshotError);
        // Continue without screenshot
      }
    }
    
    // Get the original URL for reference
    const originalUrl = new URL(url);
    
    return NextResponse.json({
      success: true,
      content: cleanContent,
      metadata: {
        title,
        description,
        url: originalUrl.href,
        domain: originalUrl.hostname,
        images: images.slice(0, 10), // Limit to first 10 images
        screenshot: screenshotUrl, // Include webpage screenshot
        wordCount: cleanContent.split(/\s+/).length,
        extractedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching webpage content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch and parse webpage content' },
      { status: 500 }
    );
  }
}
