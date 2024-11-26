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



// פונקציה לשליחת המסמך החתום במייל
async function sendSignedDocument(email, filePath) {
    let newFileName; // משתנה לשם הקובץ החדש
    try {
        const signerName = filePath.split('_')[2]; // הנחה ששם החותם הוא החלק השלישי
        const timestamp = filePath.split('_')[3]; // הנחה שהתאריך הוא החלק הרביעי
        newFileName = `${signerName}_${timestamp}.pdf`; // יצירת השם החדש
        const newFilePath = path.join(DOCUMENTS_DIR, newFileName);

        // העתקת הקובץ עם שם חדש
        fs.copyFileSync(filePath, newFilePath);
        console.log(`[INFO] New file created for sending: ${newFilePath}`);

        // החזרת שם הקובץ החדש
        return newFilePath;
    } catch (error) {
        console.error('[ERROR] Failed to create new file name:', error);
        throw error;
    }
    try {
        const transporter = nodemailer.createTransport({
            host: 'good-sign.co.il',
            port: 25,
            secure: false,
            auth: {
                user: 'pdf_sign@good-sign.co.il',
                pass: 'Qwer@1234',
            },
        });

        const mailOptions = {
            from: 'pdf_sign@good-sign.co.il',
            to: recipientEmail,
            subject: 'המסמך החתום שלך',
            text: 'הנה המסמך החתום שלך. צירפנו אותו למייל זה.',
            attachments: [
                {
                    filename: newFileName, // שימוש בשם החדש
                    path: filePath, // הנתיב עם השם החדש
                },
            ],
        };

        console.log(`[LOG] Sending email to ${email} with attachment: ${filePath}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[INFO] Email sent successfully: ${info.response}`);
        return `Email sent successfully to ${email}`;
    } catch (error) {
        console.error(`[ERROR] Failed to send email: ${error.message}`);
        throw new Error('Failed to send email');
    }
}


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

// מסלול חדש לשליחת מסמך חתום
app.post('/sendSignedDocument', async (req, res) => {
    console.log("[LOG] Entering /sendSignedDocument endpoint. Received data:", req.body); 
    const { recipientEmail, fileName } = req.body;

    if (!recipientEmail || !fileName) {
        return res.status(400).send('Missing recipient email or file name');
    }

    let signedPdfPath;

    // בדיקת קיום הקובץ עם PNG או הקובץ הרגיל
    if (fs.existsSync(path.join(DOCUMENTS_DIR, `${fileName}_signed_with_pngs.pdf`))) {
        signedPdfPath = path.join(DOCUMENTS_DIR, `${fileName}_signed_with_pngs.pdf`);
        console.log(`[DEBUG] Found file with PNGs: ${signedPdfPath}`);
    } else if (fs.existsSync(path.join(DOCUMENTS_DIR, `${fileName}_signed.pdf`))) {
        signedPdfPath = path.join(DOCUMENTS_DIR, `${fileName}_signed.pdf`);
        console.log(`[DEBUG] Found regular signed file: ${signedPdfPath}`);
    } else {
        console.error("[ERROR] No valid signed PDF found for sending.");
        return res.status(404).send('No valid signed PDF found');
    }

    try {
        const newFilePath = await sendSignedDocument(recipientEmail, signedPdfPath); // יצירת שם קובץ חדש
        console.log(`[LOG] Sending email with file: ${newFilePath} to: ${recipientEmail}`);
        const result = await sendEmailWithAttachment(recipientEmail, newFilePath); // שליחה עם הנתיב החדש
        console.log(`[INFO] Email sent successfully: ${result}`);

        res.send(`Signed document sent successfully to: ${recipientEmail}`);
    } catch (error) {
        console.error(`[ERROR] Failed to send signed document: ${error.message}`);
        res.status(500).send('Failed to send signed document');
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

const sendEmailWithAttachment = async (recipientEmail, filePath) => {
    const fileName = path.basename(filePath); // חילוץ שם הקובץ מהנתיב
    try {
        const transporter = nodemailer.createTransport({
            host: 'good-sign.co.il',
            port: 25,
            secure: false,
            auth: {
                user: 'pdf_sign@good-sign.co.il',
                pass: 'Qwer@1234',
            },
        });

        const mailOptions = {
            from: 'pdf_sign@good-sign.co.il',
            to: recipientEmail,
            subject: 'המסמך החתום שלך',
            text: 'הנה המסמך החתום שלך. צירפנו אותו למייל זה.',
            attachments: [
                {
                    filename: fileName, // שם הקובץ
                    path: filePath, // הנתיב לקובץ
                },
            ],
        };

        console.log(`[LOG] Sending email to ${recipientEmail} with attachment: ${filePath}`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[LOG] Email sent successfully: ${info.response}`);
        return `Email sent successfully to ${recipientEmail}`;
    } catch (error) {
        console.error(`[ERROR] Failed to send email: ${error.message}`);
        throw new Error('Failed to send email');
    }
};

app.post('/saveSignedDocument', async (req, res) => {
    console.log("Entering /saveSignedDocument endpoint...");

    try {
        const { pdfData, fields, fileName, recipientEmail, signerEmail } = req.body;

        const emailToSend = recipientEmail || 'mike@good-sign.co.il';

        if (!pdfData || !fileName) {
            return res.status(400).send('Missing data');
        }

        // שמירת המסמך
        const pdfPath = await processAndSavePDF(pdfData, JSON.parse(fields), fileName);

        // יצירת הקובץ עם PNG
        const signedWithPngPath = pdfPath.replace('.pdf', '_with_pngs.pdf');
        console.log(`[LOG] Signed with PNGs saved as: ${signedWithPngPath}`);

        if (!fs.existsSync(signedWithPngPath)) {
            console.error("[ERROR] PNG-enhanced PDF not found!");
            return res.status(500).send('Error creating PNG-enhanced PDF');
        }

        console.log(`[INFO] Using file for email: ${signedWithPngPath}`);

        // שליחת המסמך במייל לנמען הראשי
        try {
            const emailResult = await sendEmailWithAttachment(emailToSend, signedWithPngPath);
            console.log(`[INFO] ${emailResult}`);
        } catch (emailError) {
            console.error(`[ERROR] Failed to send email: ${emailError.message}`);
            return res.status(500).send('Document saved but failed to send email to recipient');
        }

        // שליחת המסמך במייל לחותם, אם יש כתובת מייל
        if (signerEmail) {
            try {
                const signerEmailResult = await sendEmailWithAttachment(signerEmail, signedWithPngPath);
                console.log(`[INFO] ${signerEmailResult}`);
            } catch (emailError) {
                console.error(`[ERROR] Failed to send email to signer: ${emailError.message}`);
                return res.status(500).send('Document saved but failed to send email to signer');
            }
        }

        res.send(`Document saved and sent successfully to: ${emailToSend}${signerEmail ? ` and ${signerEmail}` : ''}`);
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
    pdfDoc.registerFontkit(fontkit);
    console.log("PDF loaded successfully.");

    const arialFont = await pdfDoc.embedFont(fontBytes);
    console.log("Arial font embedded successfully.");

    for (const [index, field] of fields.entries()) {
        const page = pdfDoc.getPage(parseInt(field.pageNumber) - 1);
        const leftPosition = parseFloat(field.left) / 1.65;
        const topPosition = parseFloat(field.top) / 1.65;
        const width = parseFloat(field.width) / 1.63;
        const height = parseFloat(field.height) / 1.63;

console.log(`Field type: ${field.type}`);
console.log(`Original (SIGNER): Left: ${field.left}, Top: ${field.top}, Width: ${field.width}, Height: ${field.height}`);
console.log(`Converted (PDF): Left: ${leftPosition}, Top: ${topPosition}, Width: ${width}, Height: ${height}`);

        if (field.type && field.type.includes('text')) {
            const fontSize = height * 0.8;
            page.drawText(field.value || '', {
                x: leftPosition,
                y: page.getHeight() - topPosition - height + (height - fontSize) / 2,
                size: fontSize,
                font: arialFont,
                color: rgb(0, 0, 0),
            });
            console.log(`Text added at (${leftPosition}, ${topPosition}) on page ${field.pageNumber}`);
        } else if (field.type && field.type.includes('date')) {
            const fontSize = height * 0.8;
            const dateValue = field.value || new Date().toLocaleDateString('he-IL');
            page.drawText(dateValue, {
                x: leftPosition,
                y: page.getHeight() - topPosition - height + (height - fontSize) / 2,
                size: fontSize,
                font: arialFont,
                color: rgb(0, 0, 0),
            });
            console.log(`Date added at (${leftPosition}, ${topPosition}) on page ${field.pageNumber}`);
        } else if (field.type && field.type.includes('checkbox')) {
            page.drawRectangle({
                x: leftPosition,
                y: page.getHeight() - topPosition - height,
                width: 10,
                height: 10,
                color: rgb(1, 1, 1),
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
            });
            if (field.checked) {
                page.drawText("V", {
                    x: leftPosition + 1.5,
                    y: page.getHeight() - topPosition - height + 2,
                    size: 8,
                    color: rgb(0, 0, 0),
                });
            }
            console.log(`Checkbox drawn at (${leftPosition}, ${page.getHeight() - topPosition - height}) with ${field.checked ? "checked" : "unchecked"} status.`);
        } else if (field.type && field.type.includes('radio')) {
        console.log(`Processing radio button at (${leftPosition}, ${topPosition}) on page ${field.pageNumber} with name: ${field.name}`);    
 // טיפול בשדה Radio
            console.log(`Attempting to process radio button at (${leftPosition}, ${topPosition}) on page ${field.pageNumber}`);
            page.drawCircle({
                x: leftPosition + width / 2,
                y: page.getHeight() - topPosition - height / 2,
                size: width / 2,
                borderColor: rgb(0, 0, 0),
                borderWidth: 1,
            });
            if (field.checked) {
                page.drawCircle({
                    x: leftPosition + width / 2,
                    y: page.getHeight() - topPosition - height / 2,
                    size: width / 4,
                    color: rgb(0, 0, 0),
                });
            }
            console.log(`Radio button drawn at (${leftPosition}, ${page.getHeight() - topPosition - height / 2}) with ${field.checked ? "checked" : "unchecked"} status.`);
        } else if (field.type && field.type.includes('signature')) {
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
            console.log(`Signature added at (${leftPosition}, ${topPosition}) on page ${field.pageNumber}`);
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
        const pdfBuffer = fs.readFileSync(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        pdfDoc.registerFontkit(fontkit);
        console.log("PDF loaded successfully for PNG embedding.");

        // הטמעת PNG לפי השדות
        for (const [index, field] of fields.entries()) {
            if (field && field.type && field.type.includes('signature')) {
                const pageIndex = parseInt(field.pageNumber) - 1;
                const page = pdfDoc.getPage(pageIndex);

                const leftPosition = parseFloat(field.left) / 1.65;
                const topPosition = parseFloat(field.top) / 1.65;
                const width = parseFloat(field.width) / 1.65;
                const height = parseFloat(field.height) / 1.65;

                const pngPath = path.join(pngFiles, `fixed_signature_${index + 1}.png`);
                console.log(`Loading PNG from path: ${pngPath}`);

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

        // שמירת הקובץ עם ה-PNG
        const modifiedPdfBytes = await pdfDoc.save();
        const modifiedPdfPath = pdfPath.replace('.pdf', '_with_pngs.pdf');
        fs.writeFileSync(modifiedPdfPath, modifiedPdfBytes);
        console.log(`PDF with PNGs saved successfully at: ${modifiedPdfPath}`);

        return modifiedPdfPath;
    } catch (error) {
        console.error("Error adding PNGs to PDF:", error);
        throw error;
    }
}



app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
