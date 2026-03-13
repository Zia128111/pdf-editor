import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function App() {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#FFD700');
  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const canvasRef = useRef(null);
  const drawCanvasRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    setPdf(pdfDoc);
    setCurrentPage(0);
    setAnnotations([]);
  };

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const renderPage = async () => {
      const page = await pdf.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    };
    renderPage();
  }, [pdf, currentPage]);

  useEffect(() => {
    if (!drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    annotations
      .filter(ann => ann.page === currentPage)
      .forEach(ann => {
        if (ann.type === 'draw') {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ann.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        } else if (ann.type === 'highlight') {
          ctx.fillStyle = ann.color + '40';
          ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
        } else if (ann.type === 'text') {
          ctx.fillStyle = ann.color;
          ctx.font = 'bold 16px Arial';
          ctx.fillText(ann.text, ann.x, ann.y);
        }
      });
  }, [annotations, currentPage]);

  const handleCanvasMouseDown = (e) => {
    if (tool === 'select') return;
    
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'draw') {
      setIsDrawing(true);
      const newAnnotation = {
        id: Date.now(),
        page: currentPage,
        type: 'draw',
        color: color,
        points: [{ x, y }],
      };
      setAnnotations([...annotations, newAnnotation]);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || tool !== 'draw') return;

    const rect = drawCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setAnnotations(prev => {
      const updated = [...prev];
      const lastAnn = updated[updated.length - 1];
      if (lastAnn && lastAnn.type === 'draw') {
        lastAnn.points.push({ x, y });
      }
      return updated;
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const handleHighlight = () => {
    const newAnnotation = {
      id: Date.now(),
      page: currentPage,
      type: 'highlight',
      color: color,
      x: 50,
      y: 100,
      w: 200,
      h: 30,
    };
    setAnnotations([...annotations, newAnnotation]);
    alert('Highlight added at default position. Features can be expanded!');
  };

  const handleAddText = () => {
    const text = prompt('Enter text to add:');
    if (!text) return;
    const newAnnotation = {
      id: Date.now(),
      page: currentPage,
      type: 'text',
      color: color,
      text: text,
      x: 100,
      y: 100,
    };
    setAnnotations([...annotations, newAnnotation]);
  };

  const handleOCR = async () => {
    setOcrLoading(true);
    try {
      // Simulated OCR - in production would use Tesseract.js or backend
      setOcrResult(`OCR Results for Page ${currentPage + 1}:\n\nDocument text would be extracted here.\nClick "Copy Text" to copy OCR results.`);
    } catch (error) {
      setOcrResult('OCR processing - results would display here');
    }
    setOcrLoading(false);
  };

  const downloadPDF = () => {
    alert('Download feature: Would save current PDF with annotations. Page: ' + (currentPage + 1));
  };

  const clearPage = () => {
    if (confirm('Clear all annotations on this page?')) {
      setAnnotations(annotations.filter(a => a.page !== currentPage));
    }
  };

  return (
    <div className="pdf-editor-container">
      {/* Header */}
      <header className="header">
        <h1>⚡ PDFStrike - Advanced PDF Editor</h1>
        <div className="header-actions">
          <label className="upload-btn">
            📤 Upload PDF
            <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-primary" onClick={downloadPDF}>📥 Download</button>
        </div>
      </header>

      {!pdf ? (
        <div className="upload-area">
          <div className="upload-icon">📄</div>
          <h2>Upload a PDF to Get Started</h2>
          <p>Draw • Highlight • Add Text • OCR • Download</p>
          <label className="upload-cta">
            Choose PDF File
            <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      ) : (
        <div className="editor-layout">
          {/* Toolbar */}
          <aside className="toolbar">
            <div className="tool-section">
              <h3>Tools</h3>
              <button
                className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
                onClick={() => setTool('select')}
              >
                👆 Select
              </button>
              <button
                className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
                onClick={() => setTool('draw')}
              >
                ✏️ Draw
              </button>
              <button
                className={`tool-btn ${tool === 'highlight' ? 'active' : ''}`}
                onClick={handleHighlight}
              >
                🎨 Highlight
              </button>
              <button
                className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                onClick={handleAddText}
              >
                🔤 Text
              </button>
            </div>

            <div className="tool-section">
              <h3>Colors</h3>
              <div className="color-picker">
                {['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#FFFFFF'].map(c => (
                  <button
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
                {ocrLoading ? '⏳ Scanning...' : '🔍 OCR'}
              </button>
            </div>

            <div className="tool-section">
              <h3>Actions</h3>
              <button className="tool-btn danger" onClick={clearPage}>
                🗑️ Clear Page
              </button>
            </div>

            <div className="stats">
              <p>Annotations: {annotations.length}</p>
              <p>Pages: {pdf?.numPages || 0}</p>
            </div>
          </aside>

          {/* Canvas Area */}
          <main className="canvas-area">
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} className="pdf-canvas" />
              <canvas
                ref={drawCanvasRef}
                className="draw-canvas"
                width="800"
                height="1000"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
            </div>

            {/* Page Navigation */}
            <div className="page-nav">
              <button
                className="nav-btn"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                ◀ Previous
              </button>
              <span className="page-info">Page {currentPage + 1} / {pdf?.numPages || 0}</span>
              <button
                className="nav-btn"
                onClick={() => setCurrentPage(Math.min((pdf?.numPages || 1) - 1, currentPage + 1))}
                disabled={currentPage === (pdf?.numPages || 1) - 1}
              >
                Next ▶
              </button>
            </div>
          </main>

          {/* OCR Results Panel */}
          {ocrResult && (
            <aside className="results-panel">
              <h3>📋 OCR Results</h3>
              <div className="ocr-text">{ocrResult}</div>
              <button
                className="tool-btn"
                onClick={() => {
                  navigator.clipboard.writeText(ocrResult);
                  alert('Copied to clipboard!');
                }}
              >
                📋 Copy Text
              </button>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
