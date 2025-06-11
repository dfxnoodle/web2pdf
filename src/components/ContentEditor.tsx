'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PDFGenerator } from '@/lib/pdf-generator';
import { TypesettingRequest, TypesettingResponse } from '@/lib/azure-openai';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface ContentEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

export default function ContentEditor({ initialContent = '', onContentChange }: ContentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [formattedContent, setFormattedContent] = useState('');
  const [customCSS, setCustomCSS] = useState('');
  const [documentType, setDocumentType] = useState<'academic' | 'business' | 'newsletter' | 'report'>('academic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': [] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'video'],
      [{ 'align': [] }],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video',
    'align', 'color', 'background'
  ];

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
      const request: TypesettingRequest = {
        content,
        documentType,
        outputFormat: 'pdf',
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

      const result: TypesettingResponse = await response.json();
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
      await PDFGenerator.generateFromElement(previewRef.current, {
        filename: `${documentType}-document.pdf`,
        format: 'a4',
        orientation: 'portrait',
        quality: 2,
        margin: { top: 20, right: 20, bottom: 20, left: 20 }
      });
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
    <div className="w-full max-w-none mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Web2PDF - AI-Powered Document Generator</h1>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
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
              <div className="border border-gray-300 rounded-md">
                <ReactQuill
                  value={content}
                  onChange={handleContentChange}
                  modules={modules}
                  formats={formats}
                  style={{ minHeight: '300px' }}
                />
              </div>
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
                {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
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
                <div dangerouslySetInnerHTML={{ __html: content }} />
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
