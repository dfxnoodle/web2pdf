'use client';

import React, { useState, useRef } from 'react';

interface PDFToWebConverterProps {
  onWebsiteGenerated?: (filename: string) => void;
}

export default function PDFToWebConverter({ onWebsiteGenerated }: PDFToWebConverterProps) {
  const [selectedPDF, setSelectedPDF] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState('');
  const [generatedWebsite, setGeneratedWebsite] = useState('');
  const [websiteCSS, setWebsiteCSS] = useState('');
  const [websiteType, setWebsiteType] = useState<'landing' | 'blog' | 'portfolio' | 'documentation' | 'business' | 'personal'>('landing');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingWebsite, setIsGeneratingWebsite] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [extractedImages, setExtractedImages] = useState<Array<{data: string, type: string, description?: string}>>([]);
  const [selectedImages, setSelectedImages] = useState<Array<{data: string, type: string, description?: string}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Add new state for PDF extraction progress
  const [extractionStep, setExtractionStep] = useState('');
  const [extractionProgress, setExtractionProgress] = useState(0);

  // Add new state for refinement functionality
  const [isRefining, setIsRefining] = useState(false);
  const [showRefinementDialog, setShowRefinementDialog] = useState(false);
  const [userFeedback, setUserFeedback] = useState('');
  const [refinementHistory, setRefinementHistory] = useState<Array<{
    feedback: string;
    changes: string[];
    timestamp: Date;
  }>>([]);
  const [originalContent, setOriginalContent] = useState('');
  const [originalCSS, setOriginalCSS] = useState('');

  // Add state to track content updates for forcing re-renders
  const [contentUpdateKey, setContentUpdateKey] = useState(0);

  // Helper functions for image selection
  const toggleImageSelection = (image: {data: string, type: string, description?: string}) => {
    setSelectedImages(prev => {
      const isSelected = prev.some(img => img.data === image.data);
      if (isSelected) {
        return prev.filter(img => img.data !== image.data);
      } else {
        return [...prev, image];
      }
    });
  };

  const selectAllImages = () => {
    setSelectedImages([...extractedImages]);
  };

  const deselectAllImages = () => {
    setSelectedImages([]);
  };

  const isImageSelected = (image: {data: string, type: string, description?: string}) => {
    return selectedImages.some(img => img.data === image.data);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedPDF(file);
      setExtractedContent('');
      setGeneratedWebsite('');
      setWebsiteCSS('');
      setExtractedImages([]);
      setSelectedImages([]);
      setSuggestions([]);
      setError('');
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const extractPDFContent = async () => {
    if (!selectedPDF) {
      setError('Please select a PDF file first.');
      return;
    }

    setIsExtracting(true);
    setError('');
    setExtractionStep('Uploading PDF file...');
    setExtractionProgress(10);
    
    try {
      const formData = new FormData();
      formData.append('pdf', selectedPDF);

      // Add delay to show the upload progress
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setExtractionStep('Processing PDF with AI Vision...');
      setExtractionProgress(30);

      // Add delay before making the request
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF content');
      }

      setExtractionStep('Analyzing document structure...');
      setExtractionProgress(70);

      // Add delay before parsing response
      await new Promise(resolve => setTimeout(resolve, 600));

      const result = await response.json();
      
      setExtractionStep('Finalizing extraction...');
      setExtractionProgress(90);

      // Add delay before setting results
      await new Promise(resolve => setTimeout(resolve, 400));

      setExtractedContent(result.content);
      setExtractedImages(result.images || []);
      setSelectedImages([]); // Reset selected images when extracting new content
      setGeneratedWebsite(''); // Reset website content
      setSuggestions([]);
      
      setExtractionStep('Extraction complete!');
      setExtractionProgress(100);

      // Clear progress after delay
      setTimeout(() => {
        setExtractionStep('');
        setExtractionProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Error extracting PDF:', error);
      setError('Failed to extract PDF content. Please try again.');
    } finally {
      setIsExtracting(false);
    }
  };

  const processContentWithAI = async () => {
    if (!extractedContent.trim()) {
      setError('Please extract content from a PDF first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setProcessingStep('Initializing AI processing...');
    setProcessingProgress(10);
    
    try {
      // Step 1: Analyze PDF content and structure
      setProcessingStep('Analyzing PDF content structure...');
      setProcessingProgress(15);
      
      const structuredContent = await processWithServerSentEvents('/api/pdf-analysis-progress', {
        content: extractedContent,
        websiteType,
        images: selectedImages
      }, (progress) => {
        setProcessingStep(progress.step);
        // Map content analysis progress to 15-50% range
        const mappedProgress = 15 + (progress.percentage * 0.35);
        setProcessingProgress(Math.round(mappedProgress));
      });

      // Step 2: Generate website structure and design
      setProcessingStep('Generating website structure and design...');
      setProcessingProgress(55);
      
      const websiteRequest = {
        content: structuredContent,
        websiteType,
        images: selectedImages,
        styling: {
          theme: 'modern',
          responsive: true,
          animations: true,
          colorScheme: 'auto'
        }
      };          const websiteResult = await processWithServerSentEvents('/api/website-generation-progress', websiteRequest, (progress) => {
            setProcessingStep(progress.step);
            // Map website generation progress to 55-95% range
            const mappedProgress = 55 + (progress.percentage * 0.40);
            setProcessingProgress(Math.round(mappedProgress));
          });

          setGeneratedWebsite(typeof websiteResult.html === 'string' ? websiteResult.html : '');
          setWebsiteCSS(typeof websiteResult.css === 'string' ? websiteResult.css : '');
          setSuggestions(Array.isArray(websiteResult.suggestions) ? websiteResult.suggestions : []);
      
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

  const downloadWebsite = async () => {
    if (!generatedWebsite.trim()) {
      setError('Please generate website content first.');
      return;
    }

    setIsGeneratingWebsite(true);
    setError('');
    
    try {
      const filename = `${selectedPDF?.name.replace('.pdf', '') || 'document'}-website-${Date.now()}`;

      // Create a complete HTML document
      const fullHTML = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${filename}</title>
            <style>
              ${websiteCSS}
              
              /* Additional responsive styles */
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                background: #fff;
              }
              
              @media (max-width: 768px) {
                body { font-size: 14px; }
                .container { padding: 0 1rem; }
              }
            </style>
          </head>
          <body>
            ${generatedWebsite}
          </body>
        </html>
      `;

      // Create and download the HTML file
      const blob = new Blob([fullHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onWebsiteGenerated?.(filename);
    } catch (error) {
      console.error('Error downloading website:', error);
      setError('Failed to download website. Please try again.');
    } finally {
      setIsGeneratingWebsite(false);
    }
  };

  // Helper function to handle Server-Sent Events
  const processWithServerSentEvents = async (
    endpoint: string, 
    requestData: Record<string, unknown>, 
    onProgress: (progress: { step: string; percentage: number; chunkIndex: number; totalChunks: number }) => void
  ): Promise<Record<string, unknown>> => {
    return new Promise((resolve, reject) => {
      let result: Record<string, unknown> | null = null;

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
                      result = data.result || data;
                      if (result) {
                        resolve(result);
                      } else {
                        reject(new Error('No result received'));
                      }
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

  // Add refinement functions
  const handleRefineContent = async () => {
    if (!userFeedback.trim()) {
      setError('Please provide feedback about what you\'d like to improve.');
      return;
    }

    if (!generatedWebsite && !extractedContent) {
      setError('No website content available to refine. Please generate website first.');
      return;
    }

    setIsRefining(true);
    setError('');
    setProcessingStep('Analyzing your feedback...');
    setProcessingProgress(10);

    // Store original content if this is the first refinement
    if (!originalContent) {
      setOriginalContent(generatedWebsite || extractedContent);
      setOriginalCSS(websiteCSS);
    }

    try {
      const refinementRequest = {
        currentContent: generatedWebsite || extractedContent,
        currentCSS: websiteCSS,
        userFeedback,
        contentType: 'website' as const,
        websiteType,
        images: selectedImages,
        originalRequest: {
          websiteType,
          images: selectedImages
        }
      };

      const refinementResult = await processWithServerSentEvents('/api/apply-final-changes', refinementRequest, (progress) => {
        setProcessingStep(progress.step);
        setProcessingProgress(progress.percentage);
      });

      // Apply the refinements
      if (refinementResult.refinedContent) {
        setGeneratedWebsite(refinementResult.refinedContent as string);
      }
      if (refinementResult.refinedCSS) {
        setWebsiteCSS(refinementResult.refinedCSS as string);
      }

      // Force preview update
      setContentUpdateKey(prev => prev + 1);

      // Update suggestions with refinement suggestions
      setSuggestions([
        ...(Array.isArray(refinementResult.suggestions) ? refinementResult.suggestions : []),
        `Applied changes: ${Array.isArray(refinementResult.changes) ? refinementResult.changes.join(', ') : 'General improvements'}`
      ]);

      // Add to refinement history
      setRefinementHistory(prev => [...prev, {
        feedback: userFeedback,
        changes: Array.isArray(refinementResult.changes) ? refinementResult.changes : ['Applied improvements'],
        timestamp: new Date()
      }]);

      // Clear feedback and close dialog
      setUserFeedback('');
      setShowRefinementDialog(false);

      setProcessingStep('Refinement complete!');
      setProcessingProgress(100);

      // Clear progress after delay
      setTimeout(() => {
        setProcessingStep('');
        setProcessingProgress(0);
      }, 2000);

    } catch (error) {
      console.error('Error refining content:', error);
      setError(`Failed to refine content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRefining(false);
    }
  };

  const resetToOriginal = () => {
    if (originalContent) {
      setGeneratedWebsite(originalContent);
      setWebsiteCSS(originalCSS);
      setRefinementHistory([]);
      setSuggestions(['Reverted to original content']);
      // Force preview update
      setContentUpdateKey(prev => prev + 1);
    }
  };

  const openFullSizePreview = () => {
    if (!generatedWebsite) return;

    // Create a complete HTML document
    const fullHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PDF to Website Preview - ${selectedPDF?.name || 'Generated Website'}</title>
          <style>
            ${websiteCSS}
            
            /* Additional responsive styles */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              background: #fff;
            }
            
            @media (max-width: 768px) {
              body { font-size: 14px; }
              .container { padding: 0 1rem; }
            }
          </style>
        </head>
        <body>
          ${generatedWebsite}
        </body>
      </html>
    `;

    // Create a blob URL and open in new tab
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new tab
    const newTab = window.open(url, '_blank');
    
    // Clean up the blob URL after a short delay to allow the tab to load
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    // Optional: Focus the new tab if popup blockers don't prevent it
    if (newTab) {
      newTab.focus();
    }
  };
  
  return (
    <div className="relative">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Main Content Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Convert Your PDF to Website</h2>
            <p className="text-gray-600">Upload a PDF document and let our AI transform it into a modern, responsive website</p>
          </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Upload PDF Document
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex gap-3">
                <div className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center">
                  {selectedPDF ? selectedPDF.name : 'No PDF selected'}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-red-600 text-white border border-red-700 rounded-lg hover:bg-red-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  Browse
                </button>
                <button
                  onClick={extractPDFContent}
                  disabled={isExtracting || !selectedPDF}
                  className="px-6 py-3 bg-orange-600 text-white border border-orange-700 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  {isExtracting ? 'Extracting...' : 'Extract'}
                </button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <label htmlFor="websiteType" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                </svg>
                Website Type
              </label>
              <select
                id="websiteType"
                value={websiteType}
                onChange={(e) => setWebsiteType(e.target.value as 'landing' | 'blog' | 'portfolio' | 'documentation' | 'business' | 'personal')}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white text-gray-900"
              >
                <option value="landing" className="text-gray-800">🚀 Landing Page</option>
                <option value="blog" className="text-gray-800">📝 Blog/Article</option>
                <option value="portfolio" className="text-gray-800">💼 Portfolio</option>
                <option value="documentation" className="text-gray-800">📚 Documentation</option>
                <option value="business" className="text-gray-800">🏢 Business Site</option>
                <option value="personal" className="text-gray-800">👤 Personal Page</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={processContentWithAI}
                disabled={isProcessing || !extractedContent}
                className="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-green-500/80 to-teal-500/80 backdrop-blur-md text-white rounded-xl hover:from-green-600/90 hover:to-teal-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-white/20"
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
                    AI Generate Website
                  </>
                )}
              </button>
              <button
                onClick={downloadWebsite}
                disabled={isGeneratingWebsite || !generatedWebsite}
                className="flex-1 min-w-[200px] px-6 py-4 bg-gradient-to-r from-indigo-500/80 to-purple-500/80 backdrop-blur-md text-white rounded-xl hover:from-indigo-600/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-white/20"
              >
                {isGeneratingWebsite ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Website
                  </>
                )}
              </button>
            </div>

            {/* PDF Extraction Progress Indicator */}
            {isExtracting && extractionStep && (
              <div className="p-6 bg-orange-50/90 backdrop-blur-md border-2 border-orange-200 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg className="animate-spin h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-orange-800">PDF Extraction in Progress</h3>
                      <span className="text-lg font-bold text-orange-600">{extractionProgress}%</span>
                    </div>
                    <p className="text-orange-700 mb-3">{extractionStep}</p>
                    <div className="w-full bg-orange-200 rounded-full h-3 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm" 
                        style={{width: `${extractionProgress}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Indicator */}
            {isProcessing && processingStep && (
              <div className="p-6 bg-green-50/90 backdrop-blur-md border-2 border-green-200 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg className="animate-spin h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-green-800">AI Processing in Progress</h3>
                      <span className="text-lg font-bold text-green-600">{processingProgress}%</span>
                    </div>
                    <p className="text-green-700 mb-3">{processingStep}</p>
                    <div className="w-full bg-green-200 rounded-full h-3 shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm" 
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

            {extractedContent && (
              <div className="bg-gray-50/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Extracted Content Preview
                </h3>
                <textarea
                  value={extractedContent}
                  readOnly
                  className="w-full h-32 p-4 text-sm border-2 border-gray-300 rounded-lg bg-white resize-none focus:outline-none text-gray-900 placeholder-gray-500"
                  placeholder="Extracted content will appear here..."
                />
              </div>
            )}

            {/* Image Selection Interface */}
            {extractedImages.length > 0 && (
              <div className="bg-blue-50/90 backdrop-blur-md rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Extracted Images ({selectedImages.length}/{extractedImages.length} selected)
                  </h3>
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                  {extractedImages.map((image, index) => {
                    const isSelected = isImageSelected(image);
                    
                    return (
                      <div
                        key={`${image.data}-${index}`}
                        className={`relative p-2 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                        onClick={() => toggleImageSelection(image)}
                      >
                        <div className="relative">
                          <img
                            src={`data:${image.type};base64,${image.data}`}
                            alt={image.description || `Extracted image ${index + 1}`}
                            className="w-full h-20 object-cover rounded"
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
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-gray-600 truncate" title={image.description || 'No description'}>
                            {image.description || 'No description'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {image.type}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selection Summary */}
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center justify-between text-sm text-blue-700">
                    <span>
                      {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} will be included in website
                    </span>
                    {selectedImages.length > 0 && (
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

          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                  </svg>
                  Website Preview
                </h2>
                {generatedWebsite && (
                  <button
                    onClick={openFullSizePreview}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in New Tab
                  </button>
                )}
              </div>
              
              <div className="border-2 border-gray-300 rounded-lg min-h-[500px] max-h-[700px] overflow-hidden shadow-inner bg-white">
                {generatedWebsite ? (
                  <iframe
                    ref={previewRef}
                    srcDoc={`
                      <html>
                        <head>
                          <style>${websiteCSS}</style>
                          <style>
                            body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                            * { box-sizing: border-box; }
                          </style>
                        </head>
                        <body>${generatedWebsite}</body>
                      </html>
                    `}
                    className="w-full h-full border-0"
                    style={{ minHeight: '500px' }}
                  />
                ) : extractedContent ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed p-6 text-gray-600 overflow-y-auto h-full">{extractedContent}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                    <svg className="h-16 w-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c-5 0-9-4-9-9s4-9 9-9" />
                    </svg>
                    <p className="text-center text-lg">Upload a PDF and extract content to see the preview</p>
                    <p className="text-center text-sm mt-2">Your generated website will appear here</p>
                  </div>
                )}
              </div>
            </div>

            {websiteCSS && (
              <div className="bg-white/90 backdrop-blur-md rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Generated CSS Styles
                </h3>
                <textarea
                  value={websiteCSS}
                  onChange={(e) => setWebsiteCSS(e.target.value)}
                  className="w-full h-40 p-4 text-sm font-mono border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white resize-none text-gray-900 placeholder-gray-500"
                  placeholder="AI-generated CSS will appear here..."
                />
                <p className="text-sm text-green-600 mt-2">💡 You can edit these styles to customize the website appearance</p>
              </div>
            )}
          </div>
        </div>

        {/* Refinement Dialog */}
        {showRefinementDialog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Improve Your Website
                  </h3>
                  <button
                    onClick={() => setShowRefinementDialog(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What would you like to improve? Be specific about your requirements:
                    </label>
                    <textarea
                      value={userFeedback}
                      onChange={(e) => setUserFeedback(e.target.value)}
                      className="w-full h-32 p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-none"
                      placeholder="Example: Make the fonts larger, change the color scheme to blue, add more spacing between sections, improve the layout for better readability..."
                    />
                  </div>

                  {/* Refinement History */}
                  {refinementHistory.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Previous Improvements:</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {refinementHistory.map((entry, index) => (
                          <div key={index} className="text-sm">
                            <p className="text-gray-600 italic">&ldquo;{entry.feedback}&rdquo;</p>
                            <p className="text-green-600 text-xs mt-1">
                              Applied: {entry.changes.join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleRefineContent}
                      disabled={isRefining || !userFeedback.trim()}
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isRefining ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Improving...
                        </span>
                      ) : (
                        'Apply Improvements'
                      )}
                    </button>
                    
                    {originalContent && (
                      <button
                        onClick={resetToOriginal}
                        className="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                      >
                        Reset to Original
                      </button>
                    )}
                    
                    <button
                      onClick={() => setShowRefinementDialog(false)}
                      className="px-4 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add refinement button to the action buttons */}
        {generatedWebsite && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => setShowRefinementDialog(true)}
                disabled={isRefining}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Improve the Website
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
