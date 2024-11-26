const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Multer setup for file uploads
const upload = require('multer')({ dest: 'uploads/' });

// Webmail SMTP transporter setup
const transporter = nodemailer.createTransport({
    host: 'good-sign.co.il',  // כתובת ה-SMTP שלך
    port: 25,  // הפורט לשימוש ב-SMTP ללא הצפנה
    secure: false,  // אין שימוש ב-SSL/TLS
    auth: {
        user: 'pdf_sign@Good-Sign.co.il',  // כתובת הדוא"ל שלך
        pass: 'Qwer@1234'  // הסיסמה שלך
    }
});

// מסלול העלאה ושולח מייל עם קישור לחתימה
router.post('/upload', upload.single('file'), async (req, res) => {
    const file = req.file;
    const fileId = uuidv4();
    const filePath = path.join(__dirname, '../uploads', `${fileId}.pdf`);
    const recipientEmail = req.body.email;  // כתובת המייל של החותם שמוזנת בטופס

    // שינוי שם הקובץ לשם ייחודי (UUID)
    fs.renameSync(file.path, filePath);

    // יצירת קישור לחתימה
    const link = `http://localhost:3000/sign/${fileId}`;
    await sendEmail(recipientEmail, link); // שליחת מייל עם הקישור לחותם

    res.send('File uploaded and email sent!');
});

// מסלול שמציג את עמוד החתימה
router.get('/sign/:id', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/sign.html')); // מפנה לעמוד החתימה sign.html
});

// מסלול שמטפל בחתימה ושמירתה על הקובץ
router.post('/sign/:id', async (req, res) => {
    const fileId = req.params.id;
    const filePath = path.join(__dirname, '../uploads', `${fileId}.pdf`);
    const { signature, position } = req.body;

    // טעינת ה-PDF והטמעת החתימה
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pngImageBytes = Buffer.from(signature.split(",")[1], 'base64');
    const pngImage = await pdfDoc.embedPng(pngImageBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    firstPage.drawImage(pngImage, {
        x: position.x,
        y: position.y,
        width: 200,
        height: 100,
    });

    const signedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, signedPdfBytes);

    // שליחת ה-PDF החתום בחזרה למכין המסמך
    await sendEmail('pdf_sign@Good-Sign.co.il', filePath, true); // מחזיר את הקובץ החתום למייל שלך

    res.send('File signed and sent!');
});

// פונקציה לשליחת המייל
async function sendEmail(recipient, link, isFile = false) {
    const mailOptions = {
        from: 'pdf_sign@Good-Sign.co.il',
        to: recipient,
        subject: isFile ? 'Signed Document' : 'Please sign the document',
        text: isFile ? 'Here is the signed document.' : `Please sign your document at the following link: ${link}`,
    };

    if (isFile) {
        mailOptions.attachments = [{ path: link }];
    }

    await transporter.sendMail(mailOptions);
}

module.exports = router;
