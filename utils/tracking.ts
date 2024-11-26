import Cookies from 'js-cookie';
import { auth } from "@/utils/firebase";

const getCookieConsent = () => {
  const cookiesConsent = Cookies.get('cookie_consent_user_accepted');
  return cookiesConsent;
};

const safelyTrackEvent = (eventName: string, eventParams: object) => {
  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', eventName, eventParams);
    } catch (error) {
      console.error(`Error tracking event "${eventName}":`, error);
    }
  } else {
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

export const trackSCwebsiteUser = (stagingUUID: string, isNewUser: boolean) => {
  safelyTrackEvent('staging_user_visit', {
    event_category: 'User Source',
    event_label: 'Staging User',
    user_id: stagingUUID,
    staging_uuid: stagingUUID,
    user_type: isNewUser ? 'new_user' : 'returning_user',
    referrer: document.referrer,
  });

  if (typeof window.gtag === 'function') {
    window.gtag('set', 'user_properties', {
      is_staging_user: true,
      staging_uuid: stagingUUID,
      user_source: 'staging',
    });

    if (isNewUser) {
      safelyTrackEvent('new_staging_user', {
        event_category: 'User Acquisition',
        event_label: 'New Staging User',
        user_id: stagingUUID,
        staging_uuid: stagingUUID,
      });
    }
  }
};

export const setUserIdForAnalytics = () => {
  if (typeof window.gtag === 'function') {
    auth.onAuthStateChanged((user) => {
      const userId = user ? user.uid : undefined;
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
