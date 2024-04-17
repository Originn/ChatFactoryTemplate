import React from 'react';

interface PDFPreviewProps {
  file: File;
}

// Option 1: Functional Component
const PDFPreview: React.FC<PDFPreviewProps> = ({ file }) => {
  return (
    <div>
      <img src="/pdf-icon.png" alt="PDF Icon" width="50" height="50" />
      <p>{file.name}</p>
    </div>
  );
};


export default PDFPreview;