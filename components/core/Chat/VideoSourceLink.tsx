// components/core/Chat/VideoSourceLink.tsx
import React, { useState, useEffect } from 'react';

interface VideoSourceLinkProps {
  videoUrl: string;
  timestamp: number;
  videoName: string;
  section: string;
  onDocumentClick: (url: string) => void;
}

const VideoSourceLink: React.FC<VideoSourceLinkProps> = ({ 
  videoUrl, 
  timestamp, 
  videoName, 
  section,
  onDocumentClick 
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateSignedVideoUrl = async () => {
      try {
        setLoading(true);
        
        // Check if videoUrl is valid
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('Invalid video URL provided');
        }
        
        // Extract base URL without timestamp fragment
        const baseUrl = videoUrl.split('#')[0];
        
        // Call the signed URL API
        const response = await fetch('/api/generate-signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            url: baseUrl
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate signed URL: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        // Add timestamp fragment to signed URL
        const urlWithTimestamp = `${data.signedUrl}#t=${Math.floor(timestamp)}`;
        setSignedUrl(urlWithTimestamp);
        
      } catch (err) {
        console.error('VideoSourceLink: Error generating signed URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate signed URL');
      } finally {
        setLoading(false);
      }
    };

    generateSignedVideoUrl();
  }, [videoUrl, timestamp]);

  if (loading) {
    return (
      <p>
        <b>Video Source:</b>{' '}
        <span className="text-gray-500">
          Generating secure video link...
        </span>
      </p>
    );
  }

  if (error) {
    // Fallback to original URL with timestamp
    const fallbackUrl = videoUrl;
    
    return (
      <p>
        <b>Video Source:</b>{' '}
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onDocumentClick(fallbackUrl)}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {section ? `${videoName} - ${section}` : videoName} ({Math.floor(timestamp / 60)}:{String(Math.floor(timestamp % 60)).padStart(2, '0')})
        </a>
      </p>
    );
  }

  if (!signedUrl) {
    return (
      <p>
        <b>Video Source:</b>{' '}
        <span className="text-gray-500">Unavailable</span>
      </p>
    );
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <p>
      <b>Video Source:</b>{' '}
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onDocumentClick(signedUrl)}
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {section ? `${videoName} - ${section}` : videoName} ({formatTime(timestamp)})
      </a>
    </p>
  );
};

export default VideoSourceLink;