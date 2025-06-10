# Web2PDF - AI-Powered Document Generator ✨

A stunning, modern web application that converts structured content to printable PDFs using AI-powered typesetting. Features a beautiful glassmorphism-inspired UI with animated backgrounds and professional design. Built with Next.js, TypeScript, and Azure OpenAI.

## Features

- 🤖 **AI-Powered Typesetting**: Uses Azure OpenAI to improve document layout and formatting
- 🔍 **Smart PDF Analysis**: OpenAI Vision API extracts text from PDF documents with high accuracy
- 🖼️ **Image Description**: Automatically describes images, charts, and diagrams found in PDFs
- 📝 **Rich Text Editor**: Built-in WYSIWYG editor with React Quill
- 📄 **PDF Generation**: Convert web content to high-quality PDF documents
- 🌐 **Responsive Website Generation**: Creates mobile-first, fully responsive websites with modern CSS
- 🎨 **Beautiful Modern UI**: Stunning glassmorphism design with animated gradient backgrounds
- ✨ **Visual Effects**: Floating decorative elements, particle animations, and smooth transitions
- 🌈 **Dynamic Backgrounds**: Animated gradient backgrounds with glassmorphism effects
- 📱 **Advanced Responsive Design**: CSS Grid, Flexbox, and modern responsive techniques
- 🔧 **Content Structuring**: AI-powered content organization and semantic markup
- 🎯 **High Readability**: Carefully designed contrast and typography for optimal text readability
- 🏷️ **Feature Badges**: Interactive feature highlights with modern styling
- ♿ **Accessibility Features**: ARIA support, high contrast mode, reduced motion preferences

## Document Types Supported

- Academic papers
- Business reports
- Newsletters
- General reports
- Calendars

## Quick Start

### Prerequisites

- Node.js 22+
- Azure OpenAI account with API access

### System Dependencies

For PDF processing capabilities, the following system packages must be installed:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y imagemagick graphicsmagick
```

**macOS (using Homebrew):**
```bash
brew install imagemagick graphicsmagick
```

**CentOS/RHEL/Fedora:**
```bash
# CentOS/RHEL
sudo yum install -y ImageMagick GraphicsMagick

# Fedora
sudo dnf install -y ImageMagick GraphicsMagick
```

**Windows:**
- Download and install [ImageMagick](https://imagemagick.org/script/download.php#windows)
- Download and install [GraphicsMagick](http://www.graphicsmagick.org/download.html)

These packages are required for the `pdf2pic` library to convert PDF pages to images for OpenAI Vision API processing.

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with your Azure OpenAI credentials:
```env
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Azure OpenAI Setup

1. Create an Azure OpenAI resource in the Azure portal
2. Deploy a GPT model with Vision capabilities (GPT-4o or GPT-4-vision recommended)
3. Ensure your deployment supports Vision API for PDF analysis
4. Get your API key, endpoint, and deployment name
5. Update your `.env.local` file with these credentials

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_OPENAI_API_KEY` | Your Azure OpenAI API key | Yes |
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI endpoint URL | Yes |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Name of your deployed model (must support Vision) | Yes |
| `AZURE_OPENAI_API_VERSION` | API version (default: 202-02-01) | No |

### PDF Processing

This application uses OpenAI Vision API for comprehensive PDF analysis:
- **System Requirements**: Requires ImageMagick and GraphicsMagick installed on the system
- **PDF to Image Conversion**: Uses `pdf2pic` library to convert PDF pages to PNG images
- **Vision Analysis**: Processes images with OpenAI Vision API (`gpt-4o` model)
- **Text Extraction**: Extracts and preserves all visible text content
- **Image Descriptions**: Automatically generates descriptions for images, charts, diagrams, and visual elements
- **Multi-page Support**: Handles up to 3 pages per document (for token efficiency)
- **Structure Preservation**: Maintains document structure and formatting during extraction
- **Visual Content Analysis**: Identifies and describes charts, graphs, diagrams, and other visual elements
- **Website Generation Ready**: Image descriptions help AI generate better websites with appropriate visual content
- **Error Handling**: Graceful fallback content generation if Vision API fails
- **File Support**: Works with any standard PDF format

**Note**: Without ImageMagick/GraphicsMagick installed, PDF extraction will fail. Please ensure these system dependencies are installed before running the application.

### Responsive Website Generation

The application generates fully responsive websites using modern web standards:

**Mobile-First Design**
- Optimized for mobile devices starting from 320px width
- Touch-friendly interface with minimum 44px tap targets
- Readable typography with minimum 16px font size on mobile
- Collapsible navigation patterns for small screens

**Responsive Breakpoints**
- **Mobile**: 320px - 767px (single column, large touch targets)
- **Tablet**: 768px - 1023px (flexible layouts, readable text)
- **Desktop**: 1024px+ (multi-column, advanced layouts)

**Modern CSS Features**
- CSS Grid for main layout structure
- Flexbox for component layouts
- CSS Custom Properties (variables) for consistent theming
- Fluid typography using `clamp()` for smooth scaling
- Responsive images with `object-fit` and proper aspect ratios

**Accessibility Features**
- Semantic HTML structure with proper ARIA attributes
- High contrast mode support with `prefers-contrast`
- Reduced motion support with `prefers-reduced-motion`
- Proper color contrast ratios for WCAG compliance
- Scalable typography that works with browser zoom

**Performance Optimizations**
- Optimized image loading and responsive sizing
- Efficient CSS Grid layouts that adapt to content
- Print stylesheets for better document printing
- Modern font loading with system font fallbacks

## Troubleshooting

### PDF Processing Issues

**Error: "Could not execute GraphicsMagick/ImageMagick"**
- **Cause**: System dependencies not installed
- **Solution**: Install ImageMagick and GraphicsMagick using the commands in the System Dependencies section
- **Verification**: Run `convert --version` and `gm version` to verify installation

**Error: "No pages could be converted from PDF"**
- **Cause**: PDF file may be corrupted or system dependencies missing
- **Solution**: 
  1. Verify system dependencies are installed
  2. Test with a different PDF file
  3. Check PDF file permissions

**Error: "Vision API extraction failed"**
- **Cause**: Azure OpenAI configuration issues or API limits
- **Solution**:
  1. Verify Azure OpenAI credentials in `.env.local`
  2. Ensure your deployment supports Vision API (gpt-4o or gpt-4-vision)
  3. Check API quota and usage limits

### Node.js Package Issues

**Error during `npm install`**
- **Cause**: Peer dependency conflicts with React versions
- **Solution**: Use `npm install --legacy-peer-deps`

### Development Server Issues

**Port already in use**
- **Solution**: Kill existing processes with `pkill -f "next dev"` or use a different port

## Usage

1. **Upload PDF or Enter Content**: 
   - Upload a PDF file to extract text using OpenAI Vision API, or
   - Use the rich text editor to input your content manually
2. **Select Document Type**: Choose from academic, business, newsletter, or report
3. **Structure Content**: Click "Structure Content" to let AI organize your content
4. **Improve with AI**: Click "Improve with AI" to enhance typesetting and formatting
5. **Generate PDF**: Click "Generate PDF" to create a downloadable PDF document
