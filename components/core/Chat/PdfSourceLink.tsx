// components/core/Chat/PdfSourceLink.tsx
import React from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface PdfSourceLinkProps {
  pdfSource: string;
  pageNumber: string;
  onDocumentClick: (url: string) => void;
}

const PdfSourceLink: React.FC<PdfSourceLinkProps> = ({ 
  pdfSource, 
  pageNumber, 
  onDocumentClick 
}) => {
  const { signedUrl, loading, error } = useSignedUrl(pdfSource, pageNumber);

  if (loading) {
    return (
      <span className="text-gray-500">
        Generating secure link...
      </span>
    );
  }

  if (error) {
    console.warn('Failed to generate signed URL:', error);
    // Fallback to original URL with page fragment
    const fallbackUrl = `${pdfSource}#page=${pageNumber}`;
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const iosPageLink = isiOS ? fallbackUrl.replace('#page=', '#page') : fallbackUrl;
    
    return (
      <a
        href={iosPageLink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onDocumentClick(fallbackUrl)}
        className="text-blue-600 hover:text-blue-800 underline"
      >
        View Page {pageNumber}
      </a>
    );
  }

  if (!signedUrl) {
    return <span className="text-gray-500">Unavailable</span>;
  }

  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const iosPageLink = isiOS ? signedUrl.replace('#page=', '#page') : signedUrl;

  return (
    <a
      href={iosPageLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onDocumentClick(signedUrl)}
      className="text-blue-600 hover:text-blue-800 underline"
    >
      View Page {pageNumber}
    </a>
  );
};

export default PdfSourceLink;