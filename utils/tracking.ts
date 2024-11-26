import Cookies from 'js-cookie';
import { auth } from "@/utils/firebase";

const getCookieConsent = () => {
  const cookiesConsent = Cookies.get('cookie_consent_user_accepted');
  return cookiesConsent;
};

const safelyTrackEvent = (eventName: string, eventParams: object) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, eventParams);
    } catch (error) {
      console.error(`Error tracking event "${eventName}":`, error);
    }
  } else {
    // Optionally, queue events or retry after a delay
    console.warn('Google Analytics gtag is not loaded');
  }
};


export const handleWebinarClick = (url: string) => {
  const consent = getCookieConsent();
  if (consent === 'true') {
    safelyTrackEvent('webinar_source_click', {
      event_category: 'Webinars',
      event_label: 'Webinar',
      user_id: auth.currentUser?.uid,
      value: url,
    });
  }
};

export const handleDocumentClick = (url: string) => {
  const consent = getCookieConsent();
  if (consent === 'true') {
    safelyTrackEvent('document_source_click', {
      event_category: 'Documents',
      event_label: 'Document',
      user_id: auth.currentUser?.uid,
      value: url,
    });
  }
};

export const measureFirstTokenTime = (timeDifference: number) => {
  const consent = getCookieConsent();
  if (consent === 'true') {
    safelyTrackEvent('first_token_response_time', {
      event_category: 'ChatBot',
      event_label: 'Time from Submit to First Token',
      user_id: auth.currentUser?.uid,
      value: timeDifference,
    });
  }
};

export const handleMicClickEvent = () => {
  const consent = getCookieConsent();
  if (consent === 'true') {
    safelyTrackEvent('mic_click', {
      event_category: 'Interaction',
      event_label: 'Microphone Click',
      user_id: auth.currentUser?.uid,
    });
  }
};

export const handleSubmitClick = () => {
  safelyTrackEvent('submit_click', {
    event_category: 'ChatBot',
    event_label: 'User Submission',
    user_id: auth.currentUser?.uid,
  });
};

// utils/tracking.ts

// utils/tracking.ts

export const handleSubmitClickWeb = async () => {
  // Wait until gtag is ready
  await new Promise<void>((resolve) => {
    if (typeof window !== 'undefined') {
      if (window.gtagReady) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (window.gtagReady) {
            clearInterval(interval);
            resolve();
          }
        }, 50); // Check every 50ms
      }
    } else {
      resolve(); // In a non-browser environment, resolve immediately
    }
  });

  let userId = auth.currentUser?.uid;
  if (!userId && typeof window !== 'undefined') {
    userId = localStorage.getItem('webBrowserId') || 'anonymous';
  }

  safelyTrackEvent('submit_click_web', {
    event_category: 'ChatBot',
    event_label: 'User Submission from SolidCAM Web',
    user_id: userId,
  });
};



export const setUserIdForAnalytics = () => {
  if (typeof window.gtag === 'function') {
    auth.onAuthStateChanged((user) => {
      let userId = user ? user.uid : undefined;
      if (!userId && typeof window !== 'undefined') {
        userId = localStorage.getItem('webBrowserId') || 'anonymous';
      }
      try {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
          user_id: userId,
        });
      } catch (error) {
        console.error('Error setting user ID for analytics:', error);
      }
    });
  } else {
    console.warn('Google Analytics gtag is not loaded');
  }
};

