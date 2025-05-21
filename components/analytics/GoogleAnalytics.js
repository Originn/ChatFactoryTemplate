import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

const TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Google Analytics component for tracking page views and events
 * This component initializes Google Analytics and tracks page views automatically
 */
const GoogleAnalytics = () => {
  const router = useRouter();

  // Track route changes
  useEffect(() => {
    const handleRouteChange = (url) => {
      window.gtag('config', TRACKING_ID, {
        page_path: url,
        cookie_flags: 'SameSite=None;Secure',
      });
      window.gtag('event', 'session_start', {
        session_id: Date.now().toString(),
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Initialize Google Analytics
  useEffect(() => {
    // Skip if tracking ID is not available
    if (!TRACKING_ID) return;
    
    // Load Google Analytics script
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_ID}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag
    const scriptTag = document.createElement('script');
    scriptTag.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', '${TRACKING_ID}', {
        cookie_flags: 'SameSite=None;Secure',
      });
      gtag('event', 'session_start', {
        session_id: Date.now().toString(),
      });
    `;
    document.head.appendChild(scriptTag);
  }, []);

  // This component doesn't render anything
  return null;
};

export default GoogleAnalytics;