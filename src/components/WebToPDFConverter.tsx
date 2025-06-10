'use client';

import React, { useState, useRef } from 'react';
import { PDFGenerator } from '@/lib/pdf-generator';
import styles from './WebToPDFConverter.module.css';

interface WebToPDFConverterProps {
  onPDFGenerated?: (filename: string) => void;
}

export default function WebToPDFConverter({ onPDFGenerated }: WebToPDFConverterProps) {
  const [url, setUrl] = useState('');
  const [fetchedContent, setFetchedContent] = useState('');
  const [structuredContent, setStructuredContent] = useState('');
  const [customCSS, setCustomCSS] = useState('');
  const [documentType, setDocumentType] = useState<'academic' | 'business' | 'newsletter' | 'report' | 'article' | 'calendar'>('article');
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [images, setImages] = useState<Array<{src: string, alt: string}>>([]);
  const [selectedImages, setSelectedImages] = useState<Array<{src: string, alt: string}>>([]);
  const [screenshot, setScreenshot] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  // Helper functions for image selection
  const toggleImageSelection = (image: {src: string, alt: string}) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.src === image.src);
      if (isSelected) {
        return prev.filter(img => img.src !== image.src);
      } else {
        return [...prev, image];
      }
    });
  };

  const selectAllImages = () => {
    setSelectedImages([...images]);
  };

  const deselectAllImages = () => {
    setSelectedImages([]);
  };

  const isImageSelected = (image: {src: string, alt: string}) => {
    return selectedImages.some(img => img.src === image.src);
  };

  const fetchWebContent = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com).');
      return;
    }

    setIsFetching(true);
    setError('');
    
    try {
      const response = await fetch('/api/fetch-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch webpage content');
      }

      const result = await response.json();
      setFetchedContent(result.content);
      setImages(result.metadata?.images || []);
      setSelectedImages([]); // Reset selected images when fetching new content
      setScreenshot(result.metadata?.screenshot || '');
      setIncludeScreenshot(true); // Default to including screenshot
      setStructuredContent(''); // Reset structured content
      setSuggestions([]);
    } catch (error) {
      console.error('Error fetching content:', error);
      setError('Failed to fetch webpage content. Please check the URL and try again.');
    } finally {
      setIsFetching(false);
    }
  };

  const processContentWithAI = async () => {
    if (!fetchedContent.trim()) {
      setError('Please fetch content from a webpage first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setProcessingStep('Initializing AI processing...');
    setProcessingProgress(10);
    
    try {
      // Step 1: Structure the content with real-time progress
      setProcessingStep('Analyzing and structuring content...');
      setProcessingProgress(15);
      
      const structuredHtml = await processWithServerSentEvents('/api/content-structure-progress', {
        content: fetchedContent,
        documentType,
        images: selectedImages,
        screenshot: includeScreenshot ? screenshot : ''
      }, (progress) => {
        setProcessingStep(progress.step);
        // Map content structure progress to 15-50% range
        const mappedProgress = 15 + (progress.percentage * 0.35);
        setProcessingProgress(Math.round(mappedProgress));
      });

      setStructuredContent(structuredHtml);

      // Step 2: Enhance typesetting with real-time progress
      setProcessingStep('Enhancing typesetting with AI...');
      setProcessingProgress(55);
      
      const typesettingRequest = {
        content: structuredHtml,
        documentType,
        outputFormat: 'pdf' as const,
        images: selectedImages,
        screenshot: includeScreenshot ? screenshot : '',
        styling: {
          fontSize: 12,
          fontFamily: 'Times New Roman, serif',
          lineHeight: 1.6,
          margins: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
          }
        }
      };

      const typesettingResult = await processWithServerSentEvents('/api/typesetting-progress', typesettingRequest, (progress) => {
        setProcessingStep(progress.step);
        // Map typesetting progress to 55-95% range
        const mappedProgress = 55 + (progress.percentage * 0.40);
        setProcessingProgress(Math.round(mappedProgress));
      });

      setStructuredContent(typesettingResult.formattedContent);
      setCustomCSS(typesettingResult.styling.css);
      setSuggestions(typesettingResult.suggestions);
      
      setProcessingProgress(100);
      setProcessingStep('Processing complete!');
      
      // Clear the progress after a short delay
      setTimeout(() => {
        setProcessingStep('');
        setProcessingProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Error processing content:', error);
      setError(`Failed to process content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const structureContent = async () => {
    if (!fetchedContent.trim()) {
      setError('Please fetch content from a webpage first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    
    try {
      const response = await fetch('/api/content-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: fetchedContent,
          documentType 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to structure content');
      }

      const result = await response.json();
      setStructuredContent(result.structuredContent);
    } catch (error) {
      console.error('Error structuring content:', error);
      setError('Failed to structure content. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const enhanceTypesetting = async () => {
    const contentToProcess = structuredContent || fetchedContent;
    
    if (!contentToProcess.trim()) {
      setError('Please fetch and structure content first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    
    try {
      const request = {
        content: contentToProcess,
        documentType,
        outputFormat: 'pdf' as const,
        styling: {
          fontSize: 12,
          fontFamily: 'Times New Roman, serif',
          lineHeight: 1.6,
          margins: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
          }
        }
      };

      const response = await fetch('/api/typesetting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance typesetting');
      }

      const result = await response.json();
      setStructuredContent(result.formattedContent);
      setCustomCSS(result.styling.css);
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Error enhancing typesetting:', error);
      setError('Failed to enhance typesetting. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = async () => {
    const contentToConvert = structuredContent || fetchedContent;
    
    if (!contentToConvert.trim()) {
      setError('Please fetch content first.');
      return;
    }

    setIsGeneratingPDF(true);
    setError('');
    
    try {
      // Create filename from URL
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const filename = `${hostname}-${documentType}-${Date.now()}.pdf`;

      // Create a clean HTML document for PDF generation
      const fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              ${customCSS}
              
              /* Additional PDF-specific styles */
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Times New Roman', serif;
                font-size: 12px;
                line-height: 1.6;
                color: #000;
                background: white;
                padding: 20px;
                max-width: none;
              }
              
              @media print {
                body { margin: 0; padding: 20px; }
                .page-break { page-break-before: always; }
              }
            </style>
          </head>
          <body>
            ${contentToConvert}
          </body>
        </html>
      `;

      // Try Puppeteer method first (best for multi-page content with CSS)
      try {
        const pdfBuffer = await PDFGenerator.generateWithPuppeteerAPI(fullHTML, {
          filename,
          format: 'a4',
          orientation: 'portrait',
          margin: { top: 20, right: 20, bottom: 20, left: 20 }
        });
        
        PDFGenerator.downloadPDFFromBuffer(pdfBuffer, filename);
        onPDFGenerated?.(filename);
      } catch (puppeteerError) {
        console.warn('Puppeteer PDF failed, trying alternative methods:', puppeteerError);
        
        // Fallback: Create a temporary element with proper styling
        const tempElement = document.createElement('div');
        tempElement.innerHTML = contentToConvert;
        
        // Apply inline styles from customCSS
        if (customCSS) {
          const styleSheet = document.createElement('style');
          styleSheet.textContent = customCSS;
          document.head.appendChild(styleSheet);
        }
        
        // Hide the temporary element
        tempElement.style.position = 'fixed';
        tempElement.style.top = '-9999px';
        tempElement.style.left = '-9999px';
        tempElement.style.width = '210mm';
        tempElement.style.background = 'white';
        
        document.body.appendChild(tempElement);
        
        try {
          // Try text-based PDF generation
          await PDFGenerator.generateTextBasedPDF(tempElement, {
            filename,
            format: 'a4',
            orientation: 'portrait',
            margin: { top: 20, right: 20, bottom: 20, left: 20 }
          });
          
          onPDFGenerated?.(filename);
        } catch (textError) {
          console.warn('Text-based PDF failed, trying image-based method:', textError);
          
          // Final fallback to image-based method
          await PDFGenerator.generateFromElement(tempElement, {
            filename,
            format: 'a4',
            orientation: 'portrait',
            quality: 2,
            margin: { top: 20, right: 20, bottom: 20, left: 20 }
          });
          
          onPDFGenerated?.(filename);
        } finally {
          // Clean up
          document.body.removeChild(tempElement);
          if (customCSS) {
            const styleSheets = document.querySelectorAll('style');
            styleSheets.forEach(sheet => {
              if (sheet.textContent === customCSS) {
                document.head.removeChild(sheet);
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Helper function to handle Server-Sent Events
  const processWithServerSentEvents = async (
    endpoint: string, 
    requestData: any, 
    onProgress: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      let result: any = null;

      // Make the actual request
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.type === 'complete') {
                      result = data.structuredContent || data.result;
                      resolve(result);
                      return;
                    } else if (data.type === 'error') {
                      reject(new Error(data.error));
                      return;
                    } else {
                      // Progress update
                      onProgress({
                        step: data.step,
                        percentage: data.percentage,
                        chunkIndex: data.chunkIndex || 1,
                        totalChunks: data.totalChunks || 1
                      });
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse SSE data:', parseError);
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('Stream reading error:', streamError);
            reject(streamError);
          }
        };

        readStream();
      }).catch(error => {
        console.error('Fetch error:', error);
        reject(error);
      });

      // Timeout fallback
      setTimeout(() => {
        if (result === null) {
          reject(new Error('Request timeout'));
        }
      }, 300000); // 5 minute timeout
    });
  };

  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Main Content Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Convert Your Content</h2>
            <p className="text-gray-600">Enter a website URL and let our AI enhance it for professional PDF generation</p>
          </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Website URL
              </label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-gray-900 placeholder-gray-500"
                  placeholder="https://example.com/article"
                />
                <button
                  onClick={fetchWebContent}
                  disabled={isFetching}
                  className="px-6 py-3 bg-blue-600 text-white border border-blue-700 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  {isFetching ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <label htmlFor="documentType" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Document Type
              </label>
              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 bg-white text-gray-900"
              >
                <option value="article" className="text-gray-800">📄 Article</option>
                <option value="academic" className="text-gray-800">🎓 Academic Paper</option>
                <option value="business" className="text-gray-800">💼 Business Document</option>
                <option value="newsletter" className="text-gray-800">📰 Newsletter</option>
                <option value="report" className="text-gray-800">📊 Report</option>
                <option value="calendar" className="text-gray-800">📅 Calendar</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={processContentWithAI}
                disabled={isProcessing || !fetchedContent}
                className="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-emerald-500/80 to-blue-500/80 backdrop-blur-md text-white rounded-xl hover:from-emerald-600/90 hover:to-blue-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-white/20"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Enhance & Format
                  </>
                )}
              </button>
              <button
                onClick={generatePDF}
                disabled={isGeneratingPDF || !fetchedContent}
                className="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-purple-500/80 to-pink-500/80 backdrop-blur-md text-white rounded-xl hover:from-purple-600/90 hover:to-pink-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-white/20"
              >
                {isGeneratingPDF ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate PDF
                  </>
                )}
              </button>
            </div>

            {/* Progress Indicator */}
            {isProcessing && processingStep && (
              <div className="p-6 bg-blue-50/90 backdrop-blur-md border-2 border-blue-200 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-blue-800">AI Processing in Progress</h3>
                      <span className="text-lg font-bold text-blue-600">{processingProgress}%</span>
                    </div>
                    <p className="text-blue-700 mb-3">{processingStep}</p>
                    <div className="w-full bg-blue-200 rounded-full h-3 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm" 
                        style={{width: `${processingProgress}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-6 bg-red-50/90 backdrop-blur-md border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-semibold text-red-800 mb-1">Error</h3>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="p-6 bg-yellow-50/90 backdrop-blur-md border-2 border-yellow-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-3">AI Suggestions</h3>
                    <ul className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-yellow-700">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {fetchedContent && (
              <div className="bg-gray-50/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Raw Content Preview
                </h3>
                <textarea
                  value={fetchedContent}
                  readOnly
                  className="w-full h-32 p-4 text-sm border-2 border-gray-300 rounded-lg bg-white resize-none focus:outline-none text-gray-900 placeholder-gray-500"
                  placeholder="Fetched content will appear here..."
                />
              </div>
            )}

            {/* Image Selection Interface */}
            {(images.length > 0 || screenshot) && (
              <div className="bg-blue-50/90 backdrop-blur-md rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Image Selection
                  </h3>
                  {images.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllImages}
                        className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllImages}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                {/* Screenshot Selection */}
                {screenshot && (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeScreenshot}
                          onChange={(e) => setIncludeScreenshot(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <span className="text-sm font-medium text-blue-800">📸 Include webpage screenshot</span>
                      </label>
                    </div>
                    {includeScreenshot && (
                      <div className="ml-6 p-3 bg-white rounded-lg border border-blue-200">
                        <img
                          src={screenshot}
                          alt="Webpage screenshot"
                          className="max-w-full h-auto max-h-32 rounded border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <p className="text-xs text-gray-600 mt-2">Full webpage screenshot</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Content Images Selection */}
                {images.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-800 mb-3">
                      Content Images ({selectedImages.length}/{images.length} selected)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                      {images.map((image, index) => {
                        const isSelected = isImageSelected(image);
                        const isLikelyThumbnail = image.src.includes('thumb') || 
                                                image.src.includes('icon') || 
                                                image.src.includes('logo') || 
                                                image.alt?.toLowerCase().includes('logo') ||
                                                image.alt?.toLowerCase().includes('icon');
                        
                        return (
                          <div
                            key={`${image.src}-${index}`}
                            className={`relative p-2 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            }`}
                            onClick={() => toggleImageSelection(image)}
                          >
                            <div className="relative">
                              <img
                                src={image.src}
                                alt={image.alt || `Image ${index + 1}`}
                                className="w-full h-20 object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zNSA2NUw0NS41IDUyLjVMNTUgNjJMNzUgNDBWNzVIMjVWNDBMMzUgNjVaIiBmaWxsPSIjOUI5QkExIi8+CjxjaXJjbGUgY3g9IjY1IiBjeT0iMzUiIHI9IjUiIGZpbGw9IiM5QjlCQTEiLz4KPC9zdmc+';
                                  target.classList.add('opacity-50');
                                }}
                              />
                              <div className="absolute top-1 right-1">
                                <div className={`w-4 h-4 rounded-full border-2 border-white ${
                                  isSelected ? 'bg-blue-500' : 'bg-gray-300'
                                } flex items-center justify-center`}>
                                  {isSelected && (
                                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              {isLikelyThumbnail && (
                                <div className="absolute bottom-1 left-1">
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Thumbnail?</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 truncate" title={image.alt || 'No description'}>
                                {image.alt || 'No description'}
                              </p>
                              <p className="text-xs text-gray-400 truncate" title={image.src}>
                                {image.src.split('/').pop() || image.src}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selection Summary */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center justify-between text-sm text-blue-700">
                    <span>
                      {(includeScreenshot ? 1 : 0) + selectedImages.length} image{(includeScreenshot ? 1 : 0) + selectedImages.length !== 1 ? 's' : ''} will be included in PDF
                    </span>
                    {((includeScreenshot && screenshot) || selectedImages.length > 0) && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Ready for processing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-3">
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Formatted Preview
              </h2>
              
              <div 
                ref={previewRef}
                className={`${styles.previewContent} border-2 border-gray-300 rounded-lg min-h-[500px] max-h-[700px] overflow-y-auto shadow-inner bg-white`}
                style={{ pageBreakInside: 'avoid' }}
              >
                {structuredContent ? (
                  <div dangerouslySetInnerHTML={{ __html: structuredContent }} />
                ) : fetchedContent ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed p-6 text-gray-600">{fetchedContent}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                    <svg className="h-16 w-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-center text-lg">Enter a URL and fetch content to see the preview</p>
                    <p className="text-center text-sm mt-2">Your formatted content will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {customCSS && (
              <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Generated CSS Styles
                </h3>
                <textarea
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  className="w-full h-40 p-4 text-sm font-mono border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white resize-none text-gray-900 placeholder-gray-500"
                  placeholder="AI-generated CSS will appear here..."
                />
                <p className="text-sm text-green-600 mt-2">💡 You can edit these styles to customize the PDF appearance</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
