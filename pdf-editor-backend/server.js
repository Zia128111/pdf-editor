import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}.pdf`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// In-memory document store (replace with database in production)
const documents = new Map();
const collaborations = new Map();

// Routes

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-editor-api' });
});

/**
 * Upload PDF
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const docId = uuidv4();
    const filePath = req.file.path;

    // Extract metadata
    const fileBuffer = fs.readFileSync(filePath);
    let pageCount = 1;
    try {
      const pdfData = await pdfParse(fileBuffer);
      pageCount = pdfData.numpages;
    } catch (err) {
      console.warn('Could not parse PDF pages:', err.message);
    }

    // Store document metadata
    documents.set(docId, {
      id: docId,
      filename: req.file.originalname,
      filepath: filePath,
      filesize: req.file.size,
      pageCount,
      createdAt: new Date().toISOString(),
      annotations: [],
      owner: req.headers['x-user-id'] || 'anonymous',
    });

    res.json({
      success: true,
      docId,
      filename: req.file.originalname,
      pageCount,
      filesize: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', message: error.message });
  }
});

/**
 * Get document metadata
 */
app.get('/api/documents/:docId', (req, res) => {
  const doc = documents.get(req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({
    id: doc.id,
    filename: doc.filename,
    pageCount: doc.pageCount,
    filesize: doc.filesize,
    createdAt: doc.createdAt,
    annotationCount: doc.annotations.length,
  });
});

/**
 * Save annotations
 */
app.post('/api/documents/:docId/annotations', express.json(), (req, res) => {
  const doc = documents.get(req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const { annotations } = req.body;
  if (!Array.isArray(annotations)) {
    return res.status(400).json({ error: 'Annotations must be an array' });
  }

  doc.annotations = annotations;
  documents.set(req.params.docId, doc);

  res.json({
    success: true,
    annotationCount: annotations.length,
  });
});

/**
 * Get annotations
 */
app.get('/api/documents/:docId/annotations', (req, res) => {
  const doc = documents.get(req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({
    docId: req.params.docId,
    annotations: doc.annotations,
  });
});

/**
 * Create collaboration session
 */
app.post('/api/collaborations', express.json(), (req, res) => {
  const { docId, userId, userName } = req.body;

  if (!docId || !userId) {
    return res.status(400).json({ error: 'docId and userId required' });
  }

  const collabId = uuidv4();
  collaborations.set(collabId, {
    id: collabId,
    docId,
    participants: [
      {
        id: userId,
        name: userName || 'User',
        joinedAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  });

  res.json({
    collabId,
    docId,
    participants: collaborations.get(collabId).participants,
  });
});

/**
 * Get collaboration participants
 */
app.get('/api/collaborations/:collabId', (req, res) => {
  const collab = collaborations.get(req.params.collabId);
  if (!collab) {
    return res.status(404).json({ error: 'Collaboration not found' });
  }

  res.json(collab);
});

/**
 * Export document with annotations (placeholder)
 */
app.post('/api/documents/:docId/export', express.json(), (req, res) => {
  const doc = documents.get(req.params.docId);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // In production, use pdf-lib or similar to merge annotations
  // For now, return a placeholder
  res.json({
    success: true,
    message: 'Export queued. File will be ready in 30 seconds.',
    downloadUrl: `/api/documents/${req.params.docId}/download`,
  });
});

/**
 * Freemium feature check
 */
app.get('/api/user/plan', (req, res) => {
  const userId = req.headers['x-user-id'] || 'anonymous';

  res.json({
    userId,
    plan: 'free', // In production, lookup from database
    features: {
      maxAnnotations: 5,
      ocrPages: 0,
      collaborators: 1,
      storageGB: 0.1,
      exportFormat: 'pdf',
    },
    limits: {
      documentsPerMonth: 5,
      filesizeLimit: 25 * 1024 * 1024, // 25MB
    },
  });
});

/**
 * Upgrade to Pro (placeholder)
 */
app.post('/api/user/upgrade', express.json(), (req, res) => {
  res.json({
    success: true,
    message: 'Upgrade initiated. Redirect to payment portal.',
    paymentUrl: 'https://stripe.example.com/checkout',
  });
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`📄 PDF Editor API running on http://localhost:${PORT}`);
  console.log('✨ Endpoints: /health, /api/upload, /api/documents/:docId');
  console.log('💾 Storage: ./uploads/');
});

export default app;
