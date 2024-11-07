// UploadFile/index.js

const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure multer for handling multipart/form-data
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

module.exports = async function (context, req) {
    context.log('Processing File Upload.');

    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            context.res = {
                status: 401,
                body: { error: 'Authorization header missing.' }
            };
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            context.res = {
                status: 401,
                body: { error: 'Token missing.' }
            };
            return;
        }

        // Verify JWT Token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            context.log('Token verification successful:', decoded);
        } catch (tokenError) {
            context.res = {
                status: 401,
                body: { error: 'Invalid token.' }
            };
            return;
        }

        // Handle the file upload using multer
        await new Promise((resolve, reject) => {
            upload.single('file')(req, context.res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        const file = req.file;

        if (!file) {
            context.res = {
                status: 400,
                body: { error: 'No file uploaded.' }
            };
            return;
        }

        // Define the directory to store user files
        const userFilesDir = path.join(__dirname, '..', 'uploads', decoded.username);

        // Create the user's directory if it doesn't exist
        if (!fs.existsSync(userFilesDir)) {
            fs.mkdirSync(userFilesDir, { recursive: true });
        }

        // Move the uploaded file to the user's directory
        const destinationPath = path.join(userFilesDir, file.originalname);

        fs.renameSync(file.path, destinationPath);

        context.res = {
            status: 200,
            body: { fileName: file.originalname }
        };
    } catch (error) {
        context.log('UploadFile error:', error.message);
        context.res = {
            status: 500,
            body: { error: 'Internal server error.' }
        };
    }
};
