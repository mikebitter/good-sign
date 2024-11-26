const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit'); // ייבוא fontkit פעם אחת בלבד

const { createCanvas, loadImage } = require('canvas');

const fontPath = path.join(__dirname, 'system', 'fonts', 'arial.ttf');
const fontBytes = fs.readFileSync(fontPath);
console.log('Arial font loaded successfully');

// שאר הקוד שלך ממשיך כאן

const app = express();
const port = 3000;
const DOCUMENTS_DIR = 'C:\\remote-signing-system\\saved_documents';
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ extended: true })); 
app.use(express.static('public'));

if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR);
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "user" && password === "password") {
        res.redirect('/sign.html');
    } else {
        res.status(401).send('שם משתמש או סיסמה לא נכונים');
    }
});

app.post('/saveFields', (req, res) => {
    console.log("Received request to save fields and send email...");
    const { fields, pdfData, fileName, recipientEmail } = req.body;
    if (!fields || !pdfData || !fileName || !recipientEmail) {
        return res.status(400).send('Missing data');
    }

    try {
        const pdfPath = path.join(DOCUMENTS_DIR, `${fileName}`);
        const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
        fs.writeFileSync(pdfPath, base64Data, 'base64');
        console.log(`PDF saved to: ${pdfPath}`);

        const jsonPath = path.join(DOCUMENTS_DIR, `${fileName}_document_fields.json`);
        const formattedFields = JSON.parse(fields);  
        fs.writeFileSync(jsonPath, JSON.stringify(formattedFields, null, 2));
        console.log(`Fields saved to: ${jsonPath}`);

        const documentId = fileName;
        const link = `http://localhost:3000/sign/${documentId}`;

        const transporter = nodemailer.createTransport({
            host: 'good-sign.co.il',
            port: 25,
            secure: false, 
            auth: {
                user: 'pdf_sign@good-sign.co.il',
                pass: 'Qwer@1234'
            }
        });

        const mailOptions = {
            from: 'pdf_sign@good-sign.co.il',
            to: recipientEmail,
            subject: 'Document for Signing',
            text: `Please sign the document using the following link: ${link}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).send('Error sending email');
            }
            console.log('Email sent:', info.response);
            
            const linkPath = path.join(DOCUMENTS_DIR, `${fileName}_link.txt`);
            fs.writeFileSync(linkPath, link);
            console.log(`Link saved to: ${linkPath}`);

            res.send(`Document saved and email sent to: ${recipientEmail}`);
        });

    } catch (err) {
        console.error('Error saving PDF or fields:', err);
        return res.status(500).send('Error saving document');
    }
});

app.get('/saved_documents/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(DOCUMENTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.get('/sign/:documentId', (req, res) => {
    console.log(`Loading signer page for document ID: ${req.params.documentId}`);
    res.sendFile(path.join(__dirname, 'public', 'signer.html'));
});

app.get('/settings', (req, res) => {
    const settings = {
        creatorEmail: 'mike@halsoft.co.il', 
        theme: 'default' 
    };
    res.json(settings); 
});

app.post('/saveSignedDocument', async (req, res) => {
    try {
        const { pdfData, fields, fileName } = req.body;
        let parsedFields;
        try {
            parsedFields = JSON.parse(fields);
            console.log("Loaded fields from JSON:", parsedFields);
        } catch (error) {
            console.error("Error parsing fields JSON:", error);
            throw new Error("Invalid fields JSON");
        }
       
        if (!pdfData || !fileName) {
            return res.status(400).send('Missing data');
        }
        const pdfPath = await processAndSavePDF(pdfData, parsedFields, fileName);
        res.send(`Document saved successfully at: ${pdfPath}`);
    } catch (err) {
        console.error('Error processing PDF:', err);
        res.status(500).send('Error processing document');
    }
});

// שמירת PNG חתימה עם שם ייחודי
function saveSignatureAsPNG(left, top, width, height, fileName, signatureBase64) {
    return new Promise((resolve, reject) => {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // חשוב לוודא שהרקע שקוף
        ctx.clearRect(0, 0, width, height); // מנקה את הקנבס לשקיפות

        if (signatureBase64) {
            if (!signatureBase64.startsWith('data:image/png;base64,')) {
                signatureBase64 = `data:image/png;base64,${signatureBase64}`;
            }

            loadImage(signatureBase64).then((image) => {
                ctx.drawImage(image, 0, 0, width, height);

                const outputPath = path.join(DOCUMENTS_DIR, fileName);
                const out = fs.createWriteStream(outputPath);
                const stream = canvas.createPNGStream();
                stream.pipe(out);

                out.on('finish', () => {
                    console.log(`Signature PNG saved successfully as: ${fileName}`);
                    resolve(); // להחזיר את ההבטחה
                });

                out.on('error', (err) => {
                    console.error(`Error saving PNG file: ${err.message}`);
                    reject(err); // לדחות אם יש שגיאה
                });
            }).catch((err) => {
                console.error('Error loading signature image:', err);
                reject(err); // לדחות אם יש שגיאה
            });
        } else {
            console.error('No signatureBase64 provided.');
            reject(new Error('No signatureBase64 provided.'));
        }
    });
}

async function processAndSavePDF(pdfData, fields, fileName) {
    let pdfBuffer;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
        const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
        pdfBuffer = Buffer.from(base64Data, 'base64');
    } else {
        const pdfPath = path.join(DOCUMENTS_DIR, pdfData);
        pdfBuffer = fs.readFileSync(pdfPath);
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    pdfDoc.registerFontkit(fontkit); // רישום fontkit עבור הטמעת גופנים מותאמים אישית
    console.log("PDF loaded successfully.");

    const arialFont = await pdfDoc.embedFont(fontBytes);
    console.log("Arial font embedded successfully.");

    // לולאה לעיבוד שדות
    for (const [index, field] of fields.entries()) {
        const page = pdfDoc.getPage(parseInt(field.pageNumber) - 1);
        if (field.type.includes('signature')) {
            const leftPosition = parseFloat(field.left) / 1.7;
            const topPosition = parseFloat(field.top) / 1.7;
            const width = parseFloat(field.width) / 1.7;
            const height = parseFloat(field.height) / 1.7;

            const signatureBase64 = field.signatureBase64 || "base64 encoded string";
            const fileNameForSignature = `fixed_signature_${index + 1}.png`;

            await saveSignatureAsPNG(leftPosition, topPosition, width, height, fileNameForSignature, signatureBase64);

            page.drawRectangle({
                x: leftPosition,
                y: page.getHeight() - topPosition - height,
                width: width,
                height: height,
                borderColor: rgb(1, 0, 0),
                borderWidth: 1,
            });
        } else if (field.type.includes('text')) {
            const leftPosition = parseFloat(field.left) / 1.7;
            const topPosition = parseFloat(field.top) / 1.7;
            const width = parseFloat(field.width) / 1.7;
            const height = parseFloat(field.height) / 1.7;

            const fontSize = height * 0.8;

            page.drawText(field.value || '', {
                x: leftPosition,
                y: page.getHeight() - topPosition - height / 2,
                size: fontSize,
                font: arialFont,
                color: rgb(0, 0, 0),
            });
        }
    }

    const pdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(DOCUMENTS_DIR, `${fileName}_signed.pdf`);
    fs.writeFileSync(signedPdfPath, pdfBytes);
    console.log(`PDF saved successfully at: ${signedPdfPath}`);

    await addPNGsToPDF(signedPdfPath, DOCUMENTS_DIR, fields, fileName);
    return signedPdfPath;
}

async function addPNGsToPDF(pdfPath, pngFiles, fields, fileName) {
    try {
        const pdfBuffer = fs.readFileSync(pdfPath); // קרא את הקובץ כ-buffer
        const pdfDoc = await PDFDocument.load(pdfBuffer); // טען את מסמך ה-PDF
        pdfDoc.registerFontkit(fontkit); // רשום את fontkit לשימוש בגופנים מותאמים אישית
        console.log("PDF loaded successfully for PNG embedding.");

        // לולאה על כל שדה במערך כדי להטמיע PNG לפי הצורך
        for (const [index, field] of fields.entries()) {
            if (field.type.includes('signature')) {
                const pageIndex = parseInt(field.pageNumber) - 1;
                const page = pdfDoc.getPage(pageIndex);

                const leftPosition = parseFloat(field.left) / 1.7;
                const topPosition = parseFloat(field.top) / 1.7;
                const width = parseFloat(field.width) / 1.7;
                const height = parseFloat(field.height) / 1.7;

                const pngPath = path.join(pngFiles, `fixed_signature_${index + 1}.png`);
                console.log(`Loading PNG from path: ${pngPath}`);

                await new Promise(resolve => setTimeout(resolve, 500)); // השהייה קצרה

                try {
                    const pngImageBytes = fs.readFileSync(pngPath);
                    console.log(`PNG file loaded with size: ${pngImageBytes.length} bytes`);
                    const pngImage = await pdfDoc.embedPng(pngImageBytes);

                    page.drawImage(pngImage, {
                        x: leftPosition,
                        y: page.getHeight() - topPosition - height,
                        width: width,
                        height: height,
                    });

                    console.log(`Added PNG to page ${field.pageNumber} at coordinates (${leftPosition}, ${topPosition}).`);
                } catch (error) {
                    console.error(`Error loading or embedding PNG file: ${error.message}`);
                }
            }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        const modifiedPdfPath = pdfPath.replace('.pdf', '_with_pngs.pdf');
        fs.writeFileSync(modifiedPdfPath, modifiedPdfBytes);
        console.log(`PDF with PNGs saved successfully at: ${modifiedPdfPath}`);
    } catch (error) {
        console.error("Error adding PNGs to PDF:", error);
    }
}
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
