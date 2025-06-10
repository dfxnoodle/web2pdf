import React from 'react';
import WebToPDFConverter from '@/components/WebToPDFConverter';

export default function Home() {
  return (
    <div className="min-h-screen relative">
      {/* Decorative blobs */}
      <div className="decorative-blob"></div>
      <div className="decorative-blob"></div>
      <div className="decorative-blob"></div>
      
      {/* Header */}
      <header className="relative z-10 pt-8 pb-4">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            Web2PDF
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light drop-shadow-md mb-8">
            Transform any webpage into a beautifully formatted PDF
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        <div className="container mx-auto px-4 pb-16">
          <WebToPDFConverter />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8">
        <div className="container mx-auto px-4">
          <p className="text-white/70 text-sm">
            Powered by AI • Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
