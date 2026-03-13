import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import './App.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function App() {
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const canvasRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    setPdf(pdfDoc);
  };

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    const renderPage = async () => {
      const page = await pdf.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    };
    renderPage();
  }, [pdf, currentPage]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>📄 PDF Editor</h1>
      <input type="file" accept=".pdf" onChange={handleFileUpload} />
      {pdf && (
        <div>
          <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
            <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
          </div>
          <div style={{ marginTop: '10px' }}>
            <button onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
              Previous
            </button>
            <span> Page {currentPage + 1} / {pdf.numPages} </span>
            <button onClick={() => setCurrentPage(Math.min(pdf.numPages - 1, currentPage + 1))} disabled={currentPage === pdf.numPages - 1}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
