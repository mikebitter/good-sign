const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { PDFDocument, rgb } = require('pdf-lib');
const { createCanvas, loadImage } = require('canvas');

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

function saveSignatureAsPNG(left, top, width, height, fileName, signatureBase64) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    if (signatureBase64) {
        if (!signatureBase64.startsWith('data:image/png;base64,')) {
            signatureBase64 = `data:image/png;base64,${signatureBase64}`;
        }

        loadImage(signatureBase64).then((image) => {
            ctx.drawImage(image, 0, 0, width, height);
            const outputPath = path.join(DOCUMENTS_DIR, fileName); // השימוש בשם הקובץ שאתה רוצה

            const out = fs.createWriteStream(outputPath);
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => {
                console.log(`Signature PNG saved successfully as: ${fileName}`);
            });
        }).catch((err) => {
            console.error('Error loading signature image:', err);
        });
    }
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
    console.log("PDF loaded successfully.");

    fields.forEach(field => {
        const page = pdfDoc.getPage(parseInt(field.pageNumber) - 1);
        if (field.type.includes('signature')) {
            const leftPosition = parseFloat(field.left) / 1.7;
            const topPosition = parseFloat(field.top) / 1.7;
            const width = parseFloat(field.width) / 1.7;
            const height = parseFloat(field.height) / 1.7;

            const signatureBase64 = field.signatureBase64 || "base64 encoded string";
            // שימוש בפונקציה שלך
            saveSignatureAsPNG(leftPosition, topPosition, width, height, `${fileName}_page_${field.pageNumber}`, signatureBase64);

            page.drawRectangle({
                x: leftPosition,
                y: page.getHeight() - topPosition - height,
                width: width,
                height: height,
                borderColor: rgb(1, 0, 0),
                borderWidth: 1,
            });
        } else if (field.type.includes('text-box')) {
            const leftPosition = parseFloat(field.left) / 1.7;
            const topPosition = parseFloat(field.top) / 1.7;
            page.drawText(field.value || '', {
                x: leftPosition,
                y: page.getHeight() - topPosition,
                size: 12,
                color: rgb(0, 0, 0),
            });
        }
    });

    const pdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(DOCUMENTS_DIR, `${fileName}_signed.pdf`);
    fs.writeFileSync(signedPdfPath, pdfBytes);
    console.log(`PDF saved successfully at: ${signedPdfPath}`);

    await addPNGsToPDF(signedPdfPath, DOCUMENTS_DIR, fields, fileName);
    return signedPdfPath;
}

async function addPNGsToPDF(pdfPath, pngFiles, fields, fileName) {
    try {
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        console.log("PDF loaded successfully for PNG embedding.");

        // עבור כל שדה שנמצא ב-JSON
        for (const field of fields) {
            if (field.type.includes('signature')) {
                const pageIndex = parseInt(field.pageNumber) - 1;
                const page = pdfDoc.getPage(pageIndex);

                // המרות מיקומים לגודל ה-PDF
                const leftPosition = parseFloat(field.left) / 1.7;
                const topPosition = parseFloat(field.top) / 1.7;
                const width = parseFloat(field.width) / 1.7;
                const height = parseFloat(field.height) / 1.7;

                // הגדרת הנתיב לקובץ ה-PNG הקבוע
                const pngPath = path.join(pngFiles, 'fixed_signature.png');
                console.log(`Loading PNG from path: ${pngPath}`);

                // בדיקה אם קובץ ה-PNG קיים
                if (!fs.existsSync(pngPath)) {
                    console.error(`קובץ PNG לא נמצא: ${pngPath}`);
                    continue;
                }

                try {
                    // טעינת קובץ ה-PNG
                    const pngImageBytes = fs.readFileSync(pngPath);
                    console.log(`PNG file loaded with size: ${pngImageBytes.length} bytes`);

                    // הטמעת ה-PNG בעמוד המתאים
                    const pngImage = await pdfDoc.embedPng(pngImageBytes);
                    console.log(`PNG image embedded successfully on page ${field.pageNumber}`);

                    // הוספת תמונת ה-PNG למיקום ולגודל שהוגדר
                    page.drawImage(pngImage, {
                        x: leftPosition,
                        y: page.getHeight() - topPosition - height,
                        width: width,
                        height: height,
                    });

                    console.log(`הוספת PNG לעמוד ${field.pageNumber} במיקום (${leftPosition}, ${topPosition}).`);
                } catch (error) {
                    console.error(`שגיאה בטעינת קובץ PNG או בהטמעתו ב-PDF: ${error}`);
                }
            }
        }

        // שמירת ה-PDF עם תמונות ה-PNG שהוטמעו
        const modifiedPdfBytes = await pdfDoc.save();
        const modifiedPdfPath = pdfPath.replace('.pdf', '_with_pngs.pdf');
        fs.writeFileSync(modifiedPdfPath, modifiedPdfBytes);
        console.log(`PDF עם PNGs נשמר בהצלחה בנתיב: ${modifiedPdfPath}`);
    } catch (error) {
        console.error("שגיאה בהוספת PNGs ל-PDF:", error);
    }
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
