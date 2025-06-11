'use client';

import React, { useState } from 'react';
import WebToPDFConverter from '@/components/WebToPDFConverter';
import PDFToWebConverter from '@/components/PDFToWebConverter';

export default function Home() {
  const [mode, setMode] = useState<'web2pdf' | 'pdf2web'>('web2pdf');

  return (
    <div className="min-h-screen relative">
      {/* Decorative blobs */}
      <div className="decorative-blob"></div>
      <div className="decorative-blob"></div>
      <div className="decorative-blob"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 pb-4">
        <div className="w-full max-w-none text-center">
          {/* Mode Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-md rounded-full p-1 border border-white/30 shadow-lg">
              <button
                onClick={() => setMode('web2pdf')}
                className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                  mode === 'web2pdf'
                    ? 'bg-white text-gray-800 shadow-lg'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                🌐 Web2PDF
              </button>
              <button
                onClick={() => setMode('pdf2web')}
                className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                  mode === 'pdf2web'
                    ? 'bg-white text-gray-800 shadow-lg'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                📄 PDF2Web
              </button>
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            {mode === 'web2pdf' ? 'Web2PDF' : 'PDF2Web'}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light drop-shadow-md mb-8">
            {mode === 'web2pdf' 
              ? 'Transform any webpage into a beautifully formatted PDF'
              : 'Transform any PDF into a modern, responsive website'
            }
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {mode === 'web2pdf' ? (
              <>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  🤖 AI-Powered Formatting
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  ⚡ Instant Conversion
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  📄 Professional Results
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  🎨 Multiple Styles
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  🔍 Smart PDF Analysis
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  🌐 Modern Web Design
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  📱 Responsive Layout
                </div>
                <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white font-medium border border-white/30 shadow-lg">
                  🎯 Content Optimization
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        <div className="w-full max-w-none pb-16">
          {mode === 'web2pdf' ? (
            <WebToPDFConverter />
          ) : (
            <PDFToWebConverter />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8">
        <div className="w-full max-w-none">
          <p className="text-white/70 text-sm">
            Powered by AI • Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
