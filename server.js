const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { MongoClient, ServerApiVersion } = require('mongodb'); // Import required MongoDB components

// Create directories if they do not exist
const ensureDirectoriesExist = async () => {
  const directories = ['drawings', 'uploads'];
  for (const dir of directories) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir);
    }
  }
};

// Initialize app and check directories
const app = express();
ensureDirectoriesExist(); // Ensure directories are created
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/drawings', express.static(path.join(__dirname, 'drawings')));

// MongoDB Connection
const username = encodeURIComponent("shiwang");
const password = encodeURIComponent("shiwang");
// MongoDB connection URI
const uri = `mongodb+srv://${username}:${password}@cluster0.ytjenqf.mongodb.net/noteboard?retryWrites=true&w=majority`;

// Initialize Mongoose connection
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define PDF Schema and Model
const pdfSchema = new mongoose.Schema({
  title: String,
  description: String,
  filePath: String,
  size: Number, // Size in bytes
  uploadDate: { type: Date, default: Date.now },
  author: String,
});

const PDF = mongoose.model('PDF', pdfSchema);

// Define Drawing Schema and Model
const drawingSchema = new mongoose.Schema({
  filePath: String,
  createdAt: { type: Date, default: Date.now },
});

const Drawing = mongoose.model('Drawing', drawingSchema);

// Multer setup for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// File Upload Route
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileSize = req.file.size;

    console.log('File size:', fileSize);

    const newPDF = new PDF({
      title: req.body.title,
      description: req.body.description,
      filePath: req.file.path,
      size: fileSize,
      uploadDate: new Date(),
      author: req.body.author,
    });

    await newPDF.save();
    res.status(201).send(newPDF);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send(error);
  }
});

app.get('/pdfs', async (req, res) => {
  try {
    const pdfs = await PDF.find();
    res.json(pdfs);
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Drawing Routes
const base64ToBuffer = (dataURI) => {
  const base64Data = dataURI.split(',')[1];
  return Buffer.from(base64Data, 'base64');
};

app.post('/save-drawing', async (req, res) => {
  try {
    const { dataURL } = req.body;
    if (!dataURL) return res.status(400).json({ error: 'No drawing data received' });

    const buffer = base64ToBuffer(dataURL);
    const fileName = `drawing-${Date.now()}.png`;
    const filePath = path.join(__dirname, 'drawings', fileName);

    await fs.writeFile(filePath, buffer);

    const newDrawing = new Drawing({
      filePath: `/drawings/${fileName}`,
    });

    await newDrawing.save();
    res.json({ imageUrl: `/drawings/${fileName}` });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/drawings', async (req, res) => {
  try {
    const drawings = await Drawing.find();
    res.json(drawings.map(drawing => drawing.filePath));
  } catch (error) {
    console.error('Error fetching drawings:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/drawings/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'drawings', filename);

  try {
    const data = await fs.readFile(filePath);

    const ext = path.extname(filename).toLowerCase().slice(1);
    let mimeType;
    switch (ext) {
      case 'png':
        mimeType = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      default:
        mimeType = 'application/octet-stream';
    }

    res.setHeader('Content-Type', mimeType);
    const base64Image = `data:${mimeType};base64,${data.toString('base64')}`;
    res.json({ dataURL: base64Image });
  } catch (error) {
    console.error('Error reading image file:', error);
    res.status(404).json({ error: 'Image not found' });
  }
});

app.delete('/drawings/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'drawings', filename);

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);

    await Drawing.deleteOne({ filePath: `/drawings/${filename}` });
    res.status(200).json({ message: 'Image deleted successfully.' });
  } catch (error) {
    console.error('Error deleting image file:', error);
    res.status(500).json({ error: 'Failed to delete image.' });
  }
});

// Edit Drawing Route
app.put('/edit-drawing/:filename', async (req, res) => {
  const { filename } = req.params;
  const { dataURL } = req.body;

  if (!dataURL) return res.status(400).json({ error: 'No drawing data received' });

  const buffer = base64ToBuffer(dataURL);
  const newFilePath = path.join(__dirname, 'drawings', filename);

  try {
    await fs.writeFile(newFilePath, buffer);
    await Drawing.updateOne({ filePath: `/drawings/${filename}` }, { filePath: `/drawings/${filename}` });
    res.json({ message: 'Drawing updated successfully.', imageUrl: `/drawings/${filename}` });
  } catch (error) {
    console.error('Error updating drawing:', error);
    res.status(500).json({ error: 'Error updating drawing' });
  }
});

// Note Routes
const noteRoutes = require('./routes/notes');
app.use('/notes', noteRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
