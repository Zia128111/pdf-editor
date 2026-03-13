import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { recognize } from 'tesseract.js';
import { motion } from 'framer-motion';
import { FileUp, Download, Eye, Edit2, Zap, Users, Copy, CheckCircle } from 'lucide-react';
import create from 'zustand';
import './App.css';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Store for freemium state management
const usePricingStore = create((set) => ({
  isPro: false,
  features: {
    maxAnnotations: 5,
    ocrPages: 0,
    collaborators: 1,
    storageGB: 0.1,
  },
}));

const PDFEditorMVP = () => {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [toolMode, setToolMode] = useState('select'); // select, draw, highlight, text
  const [color, setColor] = useState('#FFD700'); // Gold highlight default
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [activeCollaborators, setActiveCollaborators] = useState([]);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfScale, setPdfScale] = useState(1.5);

  // Load PDF file
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    setPdf(pdfDoc);
    setCurrentPage(0);
    setAnnotations([]);
  }, []);

  // Render current PDF page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      const page = await pdf.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: pdfScale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Redraw annotations on canvas
      annotations
        .filter((ann) => ann.page === currentPage)
        .forEach((ann) => {
          if (ann.type === 'highlight') {
            ctx.fillStyle = ann.color + '40'; // 25% opacity
            ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
          } else if (ann.type === 'draw') {
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ann.points.forEach((p, i) => {
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          } else if (ann.type === 'text') {
            ctx.fillStyle = ann.color;
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(ann.text, ann.x, ann.y);
          }
        });
    };

    renderPage();
  }, [pdf, currentPage, annotations, pdfScale]);

  // Canvas drawing logic
  const handleCanvasMouseDown = (e) => {
    if (toolMode === 'select') return;
    setIsDrawing(true);

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pdfScale;
    const y = (e.clientY - rect.top) / pdfScale;

    if (toolMode === 'draw') {
      const newAnnotation = {
        id: Date.now(),
        page: currentPage,
        type: 'draw',
        color,
        width: 2,
        points: [{ x, y }],
      };
      setAnnotations([...annotations, newAnnotation]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || toolMode !== 'draw') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pdfScale;
    const y = (e.clientY - rect.top) / pdfScale;

    setAnnotations((prev) => {
      const lastAnnotation = { ...prev[prev.length - 1] };
      lastAnnotation.points = [...lastAnnotation.points, { x, y }];
      return [...prev.slice(0, -1), lastAnnotation];
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  // OCR function (browser-based with Tesseract.js)
  const handleOCR = useCallback(async () => {
    if (!pdf) return;

    setOcrLoading(true);
    try {
      const page = await pdf.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;

      // Extract text using Tesseract.js
      const { data } = await recognize(canvas, 'eng');

      setOcrResult(data.text);
      alert('OCR complete! Check the OCR panel.');
    } catch (error) {
      console.error('OCR error:', error);
      alert('OCR processing failed.');
    } finally {
      setOcrLoading(false);
    }
  }, [pdf, currentPage]);

  // Export PDF with annotations
  const handleExport = async () => {
    alert('Export feature coming soon! (backend integration needed)');
  };

  // Real-time collaboration simulation
  useEffect(() => {
    // Simulate receiving collaboration updates
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const names = ['Alice', 'Bob', 'Charlie'];
        setActiveCollaborators(
          Array.from({ length: Math.floor(Math.random() * 3) }, () => names[Math.floor(Math.random() * names.length)])
        );
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Copy share link
  const handleCopyShareLink = () => {
    const shareLink = `${window.location.origin}?docId=${Date.now()}`;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pageCount = pdf?.numPages || 0;

  return (
    <div className="pdf-editor-container">
      {/* Header */}
      <motion.header className="editor-header" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="header-left">
          <div className="logo">
            <Zap className="logo-icon" />
            <span>PDFStrike</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-btn" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={18} /> Upload PDF
          </button>
          <button className="header-btn pro-btn" onClick={() => alert('Coming Soon: Pro Plan')} title="Upgrade to Pro">
            ✨ Pro
          </button>
          <button className="header-btn collab-btn" onClick={() => setShowCollabPanel(!showCollabPanel)}>
            <Users size={18} /> ({activeCollaborators.length})
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden-input"
          />
        </div>
      </motion.header>

      {pdf ? (
        <div className="editor-workspace">
          {/* Toolbar */}
          <motion.aside className="editor-toolbar" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <div className="tool-section">
              <h3>Tools</h3>
              <button
                className={`tool-btn ${toolMode === 'select' ? 'active' : ''}`}
                onClick={() => setToolMode('select')}
                title="Select (V)"
              >
                ⊙ Select
              </button>
              <button
                className={`tool-btn ${toolMode === 'draw' ? 'active' : ''}`}
                onClick={() => setToolMode('draw')}
                title="Draw/Pen (P)"
              >
                ✎ Draw
              </button>
              <button
                className={`tool-btn ${toolMode === 'highlight' ? 'active' : ''}`}
                onClick={() => setToolMode('highlight')}
                title="Highlight (H)"
              >
                🎨 Highlight
              </button>
              <button
                className={`tool-btn ${toolMode === 'text' ? 'active' : ''}`}
                onClick={() => setToolMode('text')}
                title="Add Text (T)"
              >
                🔤 Text
              </button>
            </div>

            <div className="tool-section">
              <h3>Color</h3>
              <div className="color-picker">
                {['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#FFFFFF'].map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="tool-section">
              <h3>AI Features</h3>
              <button className="tool-btn primary" onClick={handleOCR} disabled={ocrLoading}>
                {ocrLoading ? 'Scanning...' : '🔍 OCR Text'}
              </button>
              <button className="tool-btn" onClick={handleExport}>
                <Download size={16} /> Export
              </button>
            </div>

            <div className="tool-section">
              <h3>Document</h3>
              <p className="annotation-count">Annotations: {annotations.length}</p>
              <button
                className="tool-btn danger"
                onClick={() => setAnnotations(annotations.filter((a) => a.page !== currentPage))}
              >
                Clear Page
              </button>
            </div>
          </motion.aside>

          {/* Canvas Area */}
          <div className="editor-canvas-area">
            <motion.div
              className="canvas-container"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <canvas
                ref={canvasRef}
                className="pdf-canvas"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </motion.div>

            {/* Page Navigation */}
            <div className="page-nav">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="nav-btn"
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {currentPage + 1} / {pageCount}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(pageCount - 1, currentPage + 1))}
                disabled={currentPage === pageCount - 1}
                className="nav-btn"
              >
                Next →
              </button>
              <div className="zoom-controls">
                <button onClick={() => setPdfScale(Math.max(1, pdfScale - 0.2))} className="zoom-btn">
                  -
                </button>
                <span>{Math.round(pdfScale * 100)}%</span>
                <button onClick={() => setPdfScale(Math.min(3, pdfScale + 0.2))} className="zoom-btn">
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Side Panel: OCR Results */}
          {ocrResult && (
            <motion.aside
              className="editor-panel ocr-panel"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
            >
              <h3>OCR Results</h3>
              <div className="ocr-text">{ocrResult}</div>
              <button className="copy-btn" onClick={() => navigator.clipboard.writeText(ocrResult)}>
                Copy Text
              </button>
            </motion.aside>
          )}

          {/* Side Panel: Collaboration */}
          {showCollabPanel && (
            <motion.aside
              className="editor-panel collab-panel"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
            >
              <h3>Collaboration</h3>
              <div className="active-users">
                <h4>Active Users</h4>
                {activeCollaborators.length > 0 ? (
                  <ul>
                    {activeCollaborators.map((name, idx) => (
                      <li key={idx}>
                        <span className="user-dot"></span> {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400">You're editing alone</p>
                )}
              </div>
              <div className="share-section">
                <h4>Share Document</h4>
                <div className="share-link">
                  <input type="text" value={`doc-${Date.now()}`} readOnly className="share-input" />
                  <button className="copy-btn" onClick={handleCopyShareLink}>
                    {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </div>
      ) : (
        <motion.div
          className="upload-prompt"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="upload-icon">
            <Eye size={64} />
          </div>
          <h2>Upload a PDF to Get Started</h2>
          <p>Annotate • OCR • Collaborate • Export</p>
          <button className="upload-cta" onClick={() => fileInputRef.current?.click()}>
            Choose PDF File
          </button>
          <p className="upload-hint">Or drag and drop a PDF anywhere</p>
        </motion.div>
      )}
    </div>
  );
};

export default PDFEditorMVP;
