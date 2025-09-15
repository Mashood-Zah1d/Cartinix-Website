import nodemailer from 'nodemailer';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.mail,
    pass: process.env.password,
  },
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../photos"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

const cpUpload = upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'color_images', maxCount: 10 }
]);

export { transporter, cpUpload };
