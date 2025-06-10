import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface PDFOptions {
  filename?: string;
  format?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  quality?: number;
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export class PDFGenerator {
  static async generateFromElement(
    element: HTMLElement,
    options: PDFOptions = {}
  ): Promise<void> {
    const {
      filename = 'document.pdf',
      format = 'a4',
      orientation = 'portrait',
      quality = 1,
      margin = { top: 20, right: 20, bottom: 20, left: 20 }
    } = options;

    try {
      // Create a clean copy of the element with inline styles
      const clonedElement = element.cloneNode(true) as HTMLElement;
      
      // Create a temporary container with safe CSS and proper page dimensions
      const tempContainer = document.createElement('div');
      const pageWidth = format === 'a4' ? 210 : format === 'letter' ? 216 : 216; // mm
      const pixelWidth = (pageWidth - margin.left - margin.right) * 3.78; // Convert mm to pixels at 96 DPI
      
      tempContainer.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: ${pixelWidth}px;
        background: white;
        font-family: Arial, sans-serif;
        color: #000000;
        line-height: 1.6;
        padding: 20px;
        box-sizing: border-box;
        font-size: 14px;
      `;
      
      // Copy content and apply safe styles
      tempContainer.innerHTML = clonedElement.innerHTML;
      
      // Apply safe styling to all elements
      const allElements = tempContainer.querySelectorAll('*');
      allElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        const tagName = htmlEl.tagName.toLowerCase();
        
        // Remove any existing styles that might interfere
        htmlEl.style.cssText = '';
        
        // Apply clean, PDF-friendly styles
        htmlEl.style.color = '#000000';
        htmlEl.style.fontFamily = 'Arial, sans-serif';
        htmlEl.style.lineHeight = '1.6';
        htmlEl.style.maxWidth = '100%';
        htmlEl.style.wordWrap = 'break-word';
        
        // Apply specific styling based on tag
        if (tagName === 'h1') {
          htmlEl.style.fontSize = '24px';
          htmlEl.style.fontWeight = 'bold';
          htmlEl.style.marginTop = '20px';
          htmlEl.style.marginBottom = '16px';
          htmlEl.style.pageBreakAfter = 'avoid';
        } else if (tagName === 'h2') {
          htmlEl.style.fontSize = '20px';
          htmlEl.style.fontWeight = 'bold';
          htmlEl.style.marginTop = '18px';
          htmlEl.style.marginBottom = '12px';
          htmlEl.style.pageBreakAfter = 'avoid';
        } else if (tagName === 'h3') {
          htmlEl.style.fontSize = '18px';
          htmlEl.style.fontWeight = 'bold';
          htmlEl.style.marginTop = '16px';
          htmlEl.style.marginBottom = '10px';
          htmlEl.style.pageBreakAfter = 'avoid';
        } else if (tagName === 'p') {
          htmlEl.style.fontSize = '14px';
          htmlEl.style.marginBottom = '12px';
          htmlEl.style.textAlign = 'justify';
        } else if (tagName === 'ul' || tagName === 'ol') {
          htmlEl.style.marginBottom = '12px';
          htmlEl.style.paddingLeft = '20px';
        } else if (tagName === 'li') {
          htmlEl.style.marginBottom = '6px';
        } else if (tagName === 'button' || tagName === 'input' || tagName === 'textarea') {
          htmlEl.style.display = 'none';
        }
      });
      
      document.body.appendChild(tempContainer);
      
      // Create canvas from the sanitized element
      const canvas = await html2canvas(tempContainer, {
        scale: quality,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        removeContainer: false,
        height: tempContainer.scrollHeight,
        width: tempContainer.scrollWidth,
      });
      
      // Remove temporary element
      document.body.removeChild(tempContainer);

      // Initialize PDF
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pdfWidth - margin.left - margin.right;
      const availableHeight = pdfHeight - margin.top - margin.bottom;

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calculate scaling to fit page width
      const scaleRatio = availableWidth / (imgWidth / quality);
      const scaledHeight = (imgHeight / quality) * scaleRatio;

      // If content fits on one page, add it normally
      if (scaledHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin.left, margin.top, availableWidth, scaledHeight);
      } else {
        // Content needs multiple pages
        let currentY = 0;
        let pageCount = 0;
        
        while (currentY < scaledHeight) {
          if (pageCount > 0) {
            pdf.addPage();
          }
          
          // Calculate how much of the image fits on this page
          const remainingHeight = scaledHeight - currentY;
          const pageImageHeight = Math.min(availableHeight, remainingHeight);
          
          // Create a cropped version of the image for this page
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            const sourceY = (currentY / scaleRatio) * quality;
            const sourceHeight = (pageImageHeight / scaleRatio) * quality;
            
            tempCanvas.width = imgWidth;
            tempCanvas.height = sourceHeight;
            
            const img = new Image();
            img.onload = () => {
              tempCtx.drawImage(img, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
              const croppedImgData = tempCanvas.toDataURL('image/png');
              pdf.addImage(croppedImgData, 'PNG', margin.left, margin.top, availableWidth, pageImageHeight);
            };
            img.src = imgData;
            
            // Wait for image to load (synchronous approach for this context)
            await new Promise(resolve => {
              img.onload = () => {
                tempCtx.drawImage(img, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
                const croppedImgData = tempCanvas.toDataURL('image/png');
                pdf.addImage(croppedImgData, 'PNG', margin.left, margin.top, availableWidth, pageImageHeight);
                resolve(true);
              };
            });
          }
          
          currentY += availableHeight;
          pageCount++;
        }
      }
      
      // Save PDF
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  // Alternative PDF generation using Puppeteer via API route (browser-safe)
  static async generateWithPuppeteerAPI(
    htmlContent: string,
    options: PDFOptions = {}
  ): Promise<ArrayBuffer> {
    const {
      format = 'a4',
      orientation = 'portrait',
      margin = { top: 20, right: 20, bottom: 20, left: 20 }
    } = options;

    try {
      const response = await fetch('/api/pdf-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent,
          options: {
            format,
            orientation,
            margin
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Error calling PDF generation API:', error);
      throw new Error('Failed to generate PDF via API');
    }
  }

  // Helper method to download PDF from buffer
  static downloadPDFFromBuffer(buffer: ArrayBuffer, filename: string): void {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Alternative text-based PDF generation for better multi-page support
  static async generateTextBasedPDF(
    element: HTMLElement,
    options: PDFOptions = {}
  ): Promise<void> {
    const {
      filename = 'document.pdf',
      format = 'a4',
      orientation = 'portrait',
      margin = { top: 20, right: 20, bottom: 20, left: 20 }
    } = options;

    try {
      const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pageWidth - margin.left - margin.right;
      const maxLineHeight = pageHeight - margin.top - margin.bottom;

      let currentY = margin.top;
      let currentPage = 1;

      // Extract text content from the element
      const extractTextContent = (el: HTMLElement): Array<{text: string, style: any}> => {
        const content: Array<{text: string, style: any}> = [];
        
        const processNode = (node: Node, currentStyle: any = {}) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
              content.push({ text, style: currentStyle });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const tagName = element.tagName.toLowerCase();
            
            let newStyle = { ...currentStyle };
            
            // Set styles based on HTML tags
            switch (tagName) {
              case 'h1':
                newStyle = { fontSize: 20, isBold: true, marginTop: 8, marginBottom: 4 };
                break;
              case 'h2':
                newStyle = { fontSize: 16, isBold: true, marginTop: 6, marginBottom: 3 };
                break;
              case 'h3':
                newStyle = { fontSize: 14, isBold: true, marginTop: 4, marginBottom: 2 };
                break;
              case 'p':
                newStyle = { fontSize: 12, marginBottom: 4 };
                break;
              case 'strong':
              case 'b':
                newStyle = { ...currentStyle, isBold: true };
                break;
              case 'em':
              case 'i':
                newStyle = { ...currentStyle, isItalic: true };
                break;
              case 'button':
              case 'input':
              case 'textarea':
                return; // Skip form elements
              default:
                newStyle = { fontSize: 12, ...currentStyle };
            }
            
            // Add line break for block elements
            if (['h1', 'h2', 'h3', 'p', 'div', 'br'].includes(tagName)) {
              if (content.length > 0) {
                content.push({ text: '\n', style: newStyle });
              }
            }
            
            // Process child nodes
            for (let i = 0; i < node.childNodes.length; i++) {
              processNode(node.childNodes[i], newStyle);
            }
            
            // Add spacing after block elements
            if (['h1', 'h2', 'h3', 'p'].includes(tagName)) {
              content.push({ text: '\n', style: newStyle });
            }
          }
        };
        
        processNode(el);
        return content;
      };

      const textContent = extractTextContent(element);
      
      // Function to add a new page
      const addNewPage = () => {
        pdf.addPage();
        currentY = margin.top;
        currentPage++;
      };

      // Function to check if we need a new page
      const checkPageBreak = (lineHeight: number) => {
        if (currentY + lineHeight > pageHeight - margin.bottom) {
          addNewPage();
          return true;
        }
        return false;
      };

      // Process each text segment
      for (const segment of textContent) {
        const { text, style } = segment;
        
        if (text === '\n') {
          currentY += style.marginBottom || 4;
          continue;
        }

        // Set font style
        if (style.isBold && style.isItalic) {
          pdf.setFont('helvetica', 'bolditalic');
        } else if (style.isBold) {
          pdf.setFont('helvetica', 'bold');
        } else if (style.isItalic) {
          pdf.setFont('helvetica', 'italic');
        } else {
          pdf.setFont('helvetica', 'normal');
        }

        const fontSize = style.fontSize || 12;
        pdf.setFontSize(fontSize);

        // Add top margin for headings
        if (style.marginTop) {
          currentY += style.marginTop;
          checkPageBreak(0);
        }

        // Split text into lines that fit the page width
        const textLines = pdf.splitTextToSize(text, availableWidth);
        
        for (const line of textLines) {
          const lineHeight = fontSize * 0.35; // Convert points to mm approximately
          
          checkPageBreak(lineHeight);
          
          pdf.text(line, margin.left, currentY);
          currentY += lineHeight + 1; // Add small line spacing
        }

        // Add bottom margin
        if (style.marginBottom) {
          currentY += style.marginBottom;
        }
      }

      pdf.save(filename);
    } catch (error) {
      console.error('Error generating text-based PDF:', error);
      throw new Error('Failed to generate text-based PDF');
    }
  }
}

export default PDFGenerator;
