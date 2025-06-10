'use client';

import React, { useState, useRef } from 'react';
import { PDFGenerator } from '@/lib/pdf-generator';

interface ContentEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

export default function BasicContentEditor({ initialContent = '', onContentChange }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [formattedContent, setFormattedContent] = useState('');
  const [customCSS, setCustomCSS] = useState('');
  const [documentType, setDocumentType] = useState<'academic' | 'business' | 'newsletter' | 'report'>('academic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleContentChange = (value: string) => {
    setContent(value);
    onContentChange?.(value);
  };

  const processWithAI = async () => {
    if (!content.trim()) {
      alert('Please enter some content first.');
      return;
    }

    setIsProcessing(true);
    try {
      const request = {
        content,
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
        throw new Error('Failed to process content');
      }

      const result = await response.json();
      setFormattedContent(result.formattedContent);
      setCustomCSS(result.styling.css);
      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Error processing content:', error);
      alert('Failed to process content with AI. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = async () => {
    if (!previewRef.current) {
      alert('No content to convert to PDF.');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Try text-based PDF generation first (better for multi-page content)
      try {
        await PDFGenerator.generateTextBasedPDF(previewRef.current, {
          filename: `${documentType}-document.pdf`,
          format: 'a4',
          orientation: 'portrait',
          margin: { top: 20, right: 20, bottom: 20, left: 20 }
        });
      } catch (textError) {
        console.warn('Text-based PDF failed, trying image-based method:', textError);
        
        // Fallback to image-based method
        try {
          await PDFGenerator.generateFromElement(previewRef.current, {
            filename: `${documentType}-document.pdf`,
            format: 'a4',
            orientation: 'portrait',
            quality: 2,
            margin: { top: 20, right: 20, bottom: 20, left: 20 }
          });
        } catch (html2canvasError) {
          console.warn('html2canvas failed, trying Puppeteer method:', html2canvasError);
          
          // Final fallback to Puppeteer method via API
          const htmlContent = previewRef.current.innerHTML;
          const pdfBuffer = await PDFGenerator.generateWithPuppeteerAPI(htmlContent, {
            filename: `${documentType}-document.pdf`,
            format: 'a4',
            orientation: 'portrait',
            margin: { top: 20, right: 20, bottom: 20, left: 20 }
          });
          
          PDFGenerator.downloadPDFFromBuffer(pdfBuffer, `${documentType}-document.pdf`);
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const structureContent = async () => {
    if (!content.trim()) {
      alert('Please enter some content first.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/content-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to structure content');
      }

      const result = await response.json();
      setContent(result.structuredContent);
    } catch (error) {
      console.error('Error structuring content:', error);
      alert('Failed to structure content. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Web2PDF - AI-Powered Document Generator</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="flex-1">
                <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="academic">Academic</option>
                  <option value="business">Business</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="report">Report</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Editor
              </label>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your content here..."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={structureContent}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Structuring...' : 'Structure Content'}
              </button>
              <button
                onClick={processWithAI}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Improve with AI'}
              </button>
              <button
                onClick={generatePDF}
                disabled={isGeneratingPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPDF ? 'Generating...' : 'Generate Multi-Page PDF'}
              </button>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="text-sm font-medium text-yellow-800 mb-2">AI Suggestions:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Preview</h2>
            
            <div 
              ref={previewRef}
              className="border border-gray-300 rounded-md p-6 bg-white min-h-[400px] shadow-inner"
              style={{ pageBreakInside: 'avoid' }}
            >
              <style>{customCSS}</style>
              {formattedContent ? (
                <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
              ) : (
                <div className="whitespace-pre-wrap">{content}</div>
              )}
            </div>

            {customCSS && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Generated CSS:</h3>
                <textarea
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  className="w-full h-32 p-2 text-xs font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="AI-generated CSS will appear here..."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
