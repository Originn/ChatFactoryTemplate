// components/GoogleAnalytics.js

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

const TRACKING_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const GoogleAnalytics = () => {
  const router = useRouter();

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

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_ID}`;
    script.async = true;
    document.head.appendChild(script);

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

  return null;
};

export default GoogleAnalytics;
