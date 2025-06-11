'use client';

import React from 'react';
import WebToPDFConverter from './WebToPDFConverter';

/**
 * Test component to verify CSS isolation in WebToPDFConverter
 * This component demonstrates that multiple instances of WebToPDFConverter
 * don't interfere with each other's styles
 */
export default function TestCSSIsolation() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold text-center mb-8">
        CSS Isolation Test
      </h1>
      
      <div className="bg-red-50 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-red-800">
          Instance 1 - Should have isolated styles
        </h2>
        <WebToPDFConverter />
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-blue-800">
          Instance 2 - Should have isolated styles
        </h2>
        <WebToPDFConverter />
      </div>
      
      <div className="bg-green-50 p-4 rounded-lg">
        <p className="text-green-800">
          <strong>Expected behavior:</strong> Each WebToPDFConverter instance should have its own
          isolated CSS scope. Custom CSS applied to one preview should not affect the other
          preview or any other elements on the page.
        </p>
      </div>
    </div>
  );
}
