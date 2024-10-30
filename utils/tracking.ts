//utils/tracking.ts
import Cookies from 'js-cookie';
import { auth } from "@/utils/firebase";

const getCookieConsent = () => {
  const cookiesConsent = Cookies.get('cookie_consent_user_accepted');
  return cookiesConsent;
};

export const handleWebinarClick = (url: string) => {
  const consent = getCookieConsent();
  if (consent && consent === 'true' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'webinar_source_click', {
      event_category: 'Webinars',
      event_label: 'Webinar',
      user_id: auth.currentUser?.uid,
      value: url,
    });
  }
};

export const handleDocumentClick = (url: string) => {
  const consent = getCookieConsent();
  if (consent && consent === 'true' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'document_source_click', {
      event_category: 'Documents',
      event_label: 'Document',
      user_id: auth.currentUser?.uid,
      value: url,
    });
  }
};

export const measureFirstTokenTime = (timeDifference: number) => {
  const consent = getCookieConsent();
  if (consent && consent === 'true' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'first_token_response_time', {
      event_category: 'ChatBot',
      event_label: 'Time from Submit to First Token',
      user_id: auth.currentUser?.uid,
      value: timeDifference,
    });
  }
};

export const handleMicClickEvent = () => {
  const consent = getCookieConsent();
  if (consent && consent === 'true' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'mic_click', {
      event_category: 'Interaction',
      event_label: 'Microphone Click',
      user_id: auth.currentUser?.uid,
    });
  }
};

export const handleSubmitClick = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'submit_click', {
      event_category: 'ChatBot',
      event_label: 'User Submission',
      user_id: auth.currentUser?.uid,
    });
  }
};

export const trackStagingUser = (stagingUUID: string, isNewUser: boolean) => {
  // Track staging user visit
  window.gtag('event', 'staging_user_visit', {
    event_category: 'User Source',
    event_label: 'Staging User',
    user_id: stagingUUID, // Use stagingUUID as user_id for consistency
    staging_uuid: stagingUUID,
    user_type: isNewUser ? 'new_user' : 'returning_user',
    referrer: document.referrer
  });

  // Set user properties for staging users
  window.gtag('set', 'user_properties', {
    is_staging_user: true,
    staging_uuid: stagingUUID,
    user_source: 'staging'
  });

  // Track new user separately
  if (isNewUser) {
    window.gtag('event', 'new_staging_user', {
      event_category: 'User Acquisition',
      event_label: 'New Staging User',
      user_id: stagingUUID,
      staging_uuid: stagingUUID
    });
  }
};


export const setUserIdForAnalytics = () => {
  if (typeof window !== 'undefined' && window.gtag) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
          'user_id': user.uid
        });
      } else {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
          'user_id': undefined
        });
      }
    });
  }
};