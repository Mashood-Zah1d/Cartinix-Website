import express from 'express'
import cors from 'cors'
import userRoutes from './Routes/UserRoutes.js'
import adminRoutes from './Routes/AdminRoutes.js'
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

app.use(express.json());
app.use(cors());

app.use("/photos", express.static(path.join(__dirname, "../photos")));

app.use('/users', userRoutes);
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
