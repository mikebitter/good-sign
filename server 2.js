const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { PDFDocument, rgb } = require('pdf-lib');


const app = express();
const port = 3000;

const DOCUMENTS_DIR = 'C:\\remote-signing-system\\saved_documents';

app.use(express.json({ limit: '50mb' }));  // הגדרת מגבלת גודל ל-50MB
app.use(express.urlencoded({ extended: true })); // פענוח נתוני טופס
app.use(express.static('public'));

// יצירת תקיות אם לא קיימות
if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR);
}

// הגדרת נתיב ראשי להפניה ל-login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// הגדרת מסלול התחברות POST
// הגדרת מסלול התחברות POST
// הגדרת מסלול התחברות POST
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // לוגיקה לבדוק שם משתמש וסיסמה (לדוגמה בלבד)
    if (username === "user" && password === "password") {
        // התחברות מוצלחת - הפניה לדף SIGN
        res.redirect('/sign.html');
    } else {
        // התחברות נכשלה
        res.status(401).send('שם משתמש או סיסמה לא נכונים');
    }
});

// מסלול לשמירת מסמכים ושליחת המייל
app.post('/saveFields', (req, res) => {
    console.log("Received request to save fields and send email...");
    const { fields, pdfData, fileName, recipientEmail } = req.body;

    if (!fields || !pdfData || !fileName || !recipientEmail) {
        return res.status(400).send('Missing data');
    }

    try {
        // שמירת קובץ ה-PDF
const pdfPath = path.join(DOCUMENTS_DIR, `${fileName}`);
        const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
        fs.writeFileSync(pdfPath, base64Data, 'base64');
        console.log(`PDF saved to: ${pdfPath}`);

        // שמירת השדות כקובץ JSON
        const jsonPath = path.join(DOCUMENTS_DIR, `${fileName}_document_fields.json`);
        const formattedFields = JSON.parse(fields);  // תוודא שהשדות מומרות כראוי
        fs.writeFileSync(jsonPath, JSON.stringify(formattedFields, null, 2));
        console.log(`Fields saved to: ${jsonPath}`);

        // יצירת לינק ייחודי למסמך
        const documentId = fileName;
        const link = `http://localhost:3000/sign/${documentId}`;

        // הגדרת השרת לשליחת מיילים
        const transporter = nodemailer.createTransport({
            host: 'good-sign.co.il',
            port: 25,
            secure: false, // אין צורך ב-TLS (לא בטוח)
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
            
            // שמירת הלינק עבור המסמך
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

// מסלול לשליפת קבצי PDF
app.get('/saved_documents/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(DOCUMENTS_DIR, fileName);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});


// מסלול לפתיחת דף החתימה
app.get('/sign/:documentId', (req, res) => {
    console.log(`Loading signer page for document ID: ${req.params.documentId}`);
    res.sendFile(path.join(__dirname, 'public', 'signer.html'));
});

// מסלול לקבלת הגדרות
app.get('/settings', (req, res) => {
    // כאן נוכל להחזיר הגדרות סטטיות או דינמיות, בהתאם לצורך שלך
    const settings = {
        creatorEmail: 'mike@halsoft.co.il', // ניתן להחליף במייל בפועל
        theme: 'default' // ניתן להוסיף פרטים נוספים
    };

    res.json(settings); // החזר את ההגדרות בפורמט JSON
});


// פונקציה לעיבוד ושיפור קובץ ה-PDF


// מסלול POST לשמירת מסמך חתום
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
        const pdfPath = await processAndSavePDF(pdfData, fields, fileName);
        res.send(`Document saved successfully at: ${pdfPath}`);
    } catch (err) {
        console.error('Error processing PDF:', err);
        res.status(500).send('Error processing document');
    }
});

// פונקציה לעיבוד ושיפור קובץ ה-PDF

// פונקציה לעיבוד ושיפור קובץ ה-PDF
// פונקציה לעיבוד ושיפור קובץ ה-PDF
async function processAndSavePDF(pdfData, fields, fileName) {
    // שלב 1: בדוק אם pdfData הוא מחרוזת מקודדת ב-base64 והמר אותה לבאפר
    let pdfBuffer;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
        const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
        pdfBuffer = Buffer.from(base64Data, 'base64');
    } else {
        // אם זה לא base64, נניח שזה שם הקובץ ישירות ונקרא מהמערכת
        const pdfPath = path.join(DOCUMENTS_DIR, pdfData);
        pdfBuffer = fs.readFileSync(pdfPath);
    }

    // שלב 2: טעינת ה-PDF מהבאפר
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // המרה של fields מאובייקט JSON עם בדיקה
    let parsedFields;
    try {
        parsedFields = JSON.parse(fields);
        console.log("Loaded fields from JSON:", parsedFields);
    } catch (error) {
        console.error("Error parsing fields JSON:", error);
        throw new Error("Invalid fields JSON");
    }

    // שלב 3: מעבר על כל השדות ושילובם במסמך
    parsedFields.forEach(field => {
        const page = pdfDoc.getPage(parseInt(field.pageNumber) - 1);

if (field.type.includes('signature')) {
    // המרה לפי נוסחת 1.7
    const leftPosition = parseFloat(field.left) / 1.7;
    const topPosition = parseFloat(field.top) / 1.7;
    const width = parseFloat(field.width) / 1.7;
    const height = parseFloat(field.height) / 1.7;

    // הצבת התיבה במיקום המדויק לפי הערכים המחושבים
    page.drawRectangle({
        x: leftPosition,
        y: page.getHeight() - topPosition - height, // התאמה לציר Y של הדף
        width: width,
        height: height,
        borderColor: rgb(1, 0, 0), // צבע אדום לתיבה כדי שנראה אותה בבדיקה
        borderWidth: 1,
    });
}


	else if (field.type.includes('text-box')) {
    // המרה לפי נוסחת 1.7 עבור שדות תיבת טקסט
    const leftPosition = parseFloat(field.left) / 1.7;
    const topPosition = parseFloat(field.top) / 1.7;

    // הצבת הטקסט במיקום המחושב לפי הערכים מה-JSON
    page.drawText(field.value || '', {
        x: leftPosition,
        y: page.getHeight() - topPosition, // התאמה לציר Y של הדף
        size: 12, // גודל גופן לתיבת טקסט
        color: rgb(0, 0, 0), // צבע שחור לטקסט
    });
}

else if (field.type.includes('date-input')) {
            page.drawText(field.value || '', {
                x: parseFloat(field.left),
                y: parseFloat(field.top),
                size: 12,
                color: rgb(0, 0, 0),
            });
        }
    });

    // שלב 4: שמירת ה-PDF השמור
    const pdfBytes = await pdfDoc.save();
    const signedPdfPath = path.join(DOCUMENTS_DIR, `${fileName}_signed.pdf`);
    fs.writeFileSync(signedPdfPath, pdfBytes);
    return signedPdfPath;
}

// הגדר כאן את app.listen כמו שהוא:
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
