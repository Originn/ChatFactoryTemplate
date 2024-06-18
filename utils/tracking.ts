import Cookies from 'js-cookie';
import { auth } from "@/utils/firebase";

const getCookieConsent = () => {
  const consent = Cookies.get('cookiesConsent');
  return consent;
};

export const handleWebinarClick = (url: string) => {
  const consent = getCookieConsent();
  if (consent && consent === 'true' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'webinar_source_click', {
      event_category: 'Webinars',
      event_label: 'Webinar',
      user_id: auth.currentUser?.email,
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
      user_id: auth.currentUser?.email,
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
      user_id: auth.currentUser?.email,
      value: timeDifference,
    });
  }
};
