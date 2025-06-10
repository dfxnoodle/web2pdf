const pdf2pic = require('pdf2pic');
const fs = require('fs');
const path = require('path');

async function testPdf2pic() {
  try {
    console.log('Testing pdf2pic with simple-test.pdf...');
    
    const pdfPath = path.join(__dirname, 'simple-test.pdf');
    console.log('PDF path:', pdfPath);
    console.log('PDF exists:', fs.existsSync(pdfPath));
    
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 150,
      saveFilename: 'page',
      savePath: __dirname,
      format: 'png',
      width: 1024,
      height: 1400
    });
    
    console.log('Attempting to convert page 1...');
    
    try {
      const result = await convert(1, { responseType: 'image' });
      console.log('Conversion result:', result);
      
      if (result && result.path) {
        console.log('✅ Conversion successful!');
        console.log('Output file:', result.path);
        console.log('File exists:', fs.existsSync(result.path));
      } else {
        console.log('❌ No path in result');
      }
    } catch (convError) {
      console.error('❌ Conversion error:', convError);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testPdf2pic();
