const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

async function createPDFWithReversedHebrewText() {
    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        const fontPath = path.join(__dirname, 'system', 'fonts', 'arial.ttf');
        const fontBytes = fs.readFileSync(fontPath);
        const arialFont = await pdfDoc.embedFont(fontBytes);
        console.log("Arial font embedded successfully.");

        // הפיכת הטקסט
        const hebrewText = 'זהו טקסט בעברית עם גופן Arial.';
        const reversedHebrewText = hebrewText.split('').reverse().join('');

        const page = pdfDoc.addPage([600, 400]);
        page.drawText(reversedHebrewText, {
            x: 50,
            y: 300,
            size: 20,
            font: arialFont,
            color: rgb(0, 0, 0)
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync('output_test_reversed.pdf', pdfBytes);
        console.log("PDF created successfully with Hebrew text in Arial font, reversed for RTL support.");
    } catch (error) {
        console.error("Error creating PDF:", error);
    }
}

createPDFWithReversedHebrewText();
