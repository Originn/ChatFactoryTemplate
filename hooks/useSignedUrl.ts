// hooks/useSignedUrl.ts
import { useState, useEffect } from 'react';

interface UseSignedUrlResult {
  signedUrl: string | null;
  loading: boolean;
  error: string | null;
}

export function useSignedUrl(url: string | null, page?: string): UseSignedUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSignedUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    // If it's already a signed URL or external URL, use it directly
    if (url.includes('X-Goog-Signature') || !url.includes('storage.googleapis.com')) {
      const finalUrl = page ? `${url}#page=${page}` : url;
      setSignedUrl(finalUrl);
      setLoading(false);
      setError(null);
      return;
    }

    // Generate signed URL for storage URLs
    const generateSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/generate-signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, page }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to generate signed URL');
        }

        setSignedUrl(data.signedUrl);
      } catch (err: any) {
        console.error('Error generating signed URL:', err);
        setError(err.message);
        // Fallback to original URL with page fragment
        const fallbackUrl = page ? `${url}#page=${page}` : url;
        setSignedUrl(fallbackUrl);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();
  }, [url, page]);

  return { signedUrl, loading, error };
}