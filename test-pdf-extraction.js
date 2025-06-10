// Test script for PDF extraction
const fs = require('fs');
const FormData = require('form-data');

async function testPdfExtraction() {
  try {
    // Read the PDF file
    const pdfBuffer = fs.readFileSync('./simple-test.pdf');
    
    // Create form data
    const formData = new FormData();
    formData.append('pdf', pdfBuffer, {
      filename: 'simple-test.pdf',
      contentType: 'application/pdf'
    });
    
    // Make the API call
    const response = await fetch('http://localhost:3000/api/extract-pdf', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ PDF extraction successful!');
      console.log('📄 Extracted content length:', result.content.length);
      console.log('📊 Metadata:', result.metadata);
      console.log('🖼️ Images found:', result.images.length);
      console.log('📝 Content preview:');
      console.log(result.content.substring(0, 500));
      console.log('...');
    } else {
      console.error('❌ PDF extraction failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testPdfExtraction();
