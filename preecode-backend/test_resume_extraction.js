/**
 * Test script to verify text extraction from resume files.
 * Run: node test_resume_extraction.js
 */
const fs = require('fs');
const path = require('path');

// Try to load pdf-parse
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (_) {
  console.warn('pdf-parse not available');
}

async function extractTextFromBuffer(buffer, fileType) {
  try {
    if (fileType === 'txt') {
      return buffer.toString('utf-8');
    }

    if (fileType === 'pdf') {
      if (pdfParse && pdfParse.PDFParse) {
        try {
          const instance = new pdfParse.PDFParse({ data: buffer, verbosity: 0 });
          await instance.load();
          const text = await instance.getText();
          const cleaned = (text || '').trim();
          if (cleaned.length > 20) return `[pdf-parse] ${cleaned}`;
        } catch (pdfErr) {
          console.log('pdf-parse failed:', pdfErr.message);
        }
      }

      // PDF fallback
      try {
        let rawPdf = buffer.toString('latin1');
        rawPdf = rawPdf.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const textBlocks = [];
        const btEtRegex = /BT[\s\S]*?ET/g;
        let btMatch;
        while ((btMatch = btEtRegex.exec(rawPdf)) !== null) {
          const block = btMatch[0];
          const parenRegex = /\(([^)]*)\)/g;
          let pMatch;
          while ((pMatch = parenRegex.exec(block)) !== null) {
            const str = pMatch[1]
              .replace(/\\([0-9]{3})/g, (_, d) => String.fromCharCode(parseInt(d, 8)))
              .replace(/\\([nrtf])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', f: '\f' }[c] || c))
              .replace(/\\(.)/g, '$1')
              .replace(/\s+/g, ' ');
            if (str.length > 2) textBlocks.push(str);
          }
        }
        if (textBlocks.length > 3) {
          const result = textBlocks.join(' ').trim();
          if (result.length > 50) return `[pdf-btet-extract] ${result.slice(0, 200)}...`;
        }

        const words = rawPdf.match(/[A-Za-z][A-Za-z0-9._\-]{2,}/g);
        if (words && words.length > 10) {
          return `[pdf-word-extract] ${words.slice(0, 50).join(' ')}...`;
        }
      } catch (fallbackErr) {
        console.log('PDF fallback failed:', fallbackErr.message);
      }

      // Generic fallback
      const raw = buffer.toString('utf-8');
      const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
                         .replace(/[\x80-\xFF]/g, '')
                         .replace(/\s+/g, ' ')
                         .trim();
      if (cleaned.length > 50) return `[utf8-extract] ${cleaned.slice(0, 200)}...`;

      const latinText = buffer.toString('latin1');
      const words2 = latinText.match(/[A-Za-z][A-Za-z0-9._@#\-]{2,}/g);
      if (words2 && words2.length > 10) {
        return `[latin1-extract] ${words2.slice(0, 50).join(' ')}...`;
      }

      return '';
    }

    if (fileType === 'docx') {
      const raw = buffer.toString('utf-8');
      const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
                         .replace(/[\x80-\xFF]/g, '')
                         .replace(/\s+/g, ' ')
                         .trim();
      if (cleaned.length > 50) return `[docx-utf8] ${cleaned.slice(0, 200)}...`;
      return '';
    }

    return buffer.toString('utf-8');
  } catch (err) {
    console.error('Extraction error:', err.message);
    return '';
  }
}

async function main() {
  // Test with a simple text buffer
  const textContent = "This is a test resume.\nName: John Doe\nSkills: JavaScript, Python, React, Node.js\nExperience: 5 years as a Full Stack Developer";
  
  console.log('\n=== Test 1: TXT file ===');
  const txtResult = await extractTextFromBuffer(Buffer.from(textContent), 'txt');
  console.log('Result:', txtResult ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Length:', txtResult?.length || 0);

  console.log('\n=== Test 2: PDF (simulated with BT/ET markers) ===');
  const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 187 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(John Doe - Software Engineer) Tj\n0 -14 Td\n(Skills: JavaScript, Python, React, Node.js, AWS) Tj\n0 -14 Td\n(Experience: 5 years Full Stack Development) Tj\n0 -14 Td\n(Education: B.Tech Computer Science) Tj\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000504 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n566\n%%EOF';
  const pdfResult = await extractTextFromBuffer(Buffer.from(pdfContent, 'latin1'), 'pdf');
  console.log('Result:', pdfResult ? '✅ SUCCESS' : '❌ FAILED (checking generic fallback)');
  if (pdfResult) console.log('Extracted:', pdfResult);

  // Test generic fallback with binary-like data
  console.log('\n=== Test 3: Generic binary with embedded text ===');
  const binaryWithText = Buffer.concat([
    Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]),
    Buffer.from('Hello World this is a resume with Java and Python skills Node.js React AWS', 'latin1'),
    Buffer.from([0x00, 0x80, 0x81, 0x82]),
  ]);
  // Since this isn't a valid PDF, it will go through generic fallback
  const binaryResult = await extractTextFromBuffer(binaryWithText, 'pdf');
  console.log('Result:', binaryResult ? '✅ SUCCESS' : '❌ FAILED');
  if (binaryResult) console.log('Extracted:', binaryResult.slice(0, 100));

  // Test DOCX (just UTF-8 fallback for non-zip data)
  console.log('\n=== Test 4: DOCX (simulated) ===');
  const docxResult = await extractTextFromBuffer(Buffer.from('PK\u0003\u0004\u0000\u0000\u0000\u0000Some random binary data that represents a docx'), 'docx');
  console.log('Result: DOCX extraction attempted (may fail without proper zip)');

  console.log('\n=== Summary ===');
  console.log('All extraction methods tested.');
  
  // Cleanup
  process.exit(0);
}

main().catch(console.error);