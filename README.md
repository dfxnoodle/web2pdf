# Web2PDF - AI-Powered Document Generator ✨

A stunning, modern web application that converts structured content to printable PDFs using AI-powered typesetting. Features a beautiful glassmorphism-inspired UI with animated backgrounds and professional design. Built with Next.js, TypeScript, and Azure OpenAI.

## Features

- 🤖 **AI-Powered Typesetting**: Uses Azure OpenAI to improve document layout and formatting
- 📝 **Rich Text Editor**: Built-in WYSIWYG editor with React Quill
- 📄 **PDF Generation**: Convert web content to high-quality PDF documents
- 🎨 **Beautiful Modern UI**: Stunning glassmorphism design with animated gradient backgrounds
- ✨ **Visual Effects**: Floating decorative elements, particle animations, and smooth transitions
- 🌈 **Dynamic Backgrounds**: Animated gradient backgrounds with glassmorphism effects
- 📱 **Responsive Design**: Fully responsive modern interface optimized for all devices
- 🔧 **Content Structuring**: AI-powered content organization and semantic markup
- 🎯 **High Readability**: Carefully designed contrast and typography for optimal text readability
- 🏷️ **Feature Badges**: Interactive feature highlights with modern styling

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
AZURE_OPENAI_API_VERSION=2024-02-01
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Azure OpenAI Setup

1. Create an Azure OpenAI resource in the Azure portal
2. Deploy a GPT model (model-router or GPT-4o recommended)
3. Get your API key, endpoint, and deployment name
4. Update your `.env.local` file with these credentials

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AZURE_OPENAI_API_KEY` | Your Azure OpenAI API key | Yes |
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI endpoint URL | Yes |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | Name of your deployed model | Yes |
| `AZURE_OPENAI_API_VERSION` | API version (default: 2024-02-01) | No |

## Usage

1. **Enter Content**: Use the rich text editor to input your content
2. **Select Document Type**: Choose from academic, business, newsletter, or report
3. **Structure Content**: Click "Structure Content" to let AI organize your content
4. **Improve with AI**: Click "Improve with AI" to enhance typesetting and formatting
5. **Generate PDF**: Click "Generate PDF" to create a downloadable PDF document
