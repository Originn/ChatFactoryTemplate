// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preload the Inter font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
        {/* Other head elements */}
        {/* Cookie Consent by TermsFeed */}
        <script
          type="text/javascript"
          src="https://www.termsfeed.com/public/cookie-consent/4.1.0/cookie-consent.js"
          charSet="UTF-8"
        ></script>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('DOMContentLoaded', function () {
                cookieconsent.run({
                  "notice_banner_type": "simple",
                  "consent_type": "express",
                  "palette": "light",
                  "language": "en",
                  "page_load_consent_levels": ["strictly-necessary"],
                  "notice_banner_reject_button_hide": false,
                  "preferences_center_close_button_hide": false,
                  "page_refresh_confirmation_buttons": false,
                  "website_name": "solidcamchat",
                  "website_privacy_policy_url": "https://www.solidcamchat.com/privacy-policy",
                  onInitialConsent: function() {
                    const consentStatus = cookieconsent.hasConsented('tracking');
                    if (consentStatus) {
                      Cookies.set('cookieConsent', 'true', { expires: 365 });
                    } else {
                      Cookies.set('cookieConsent', 'false', { expires: 365 });
                      disableTrackingScripts();
                    }
                  },
                  onStatusChange: function(status) {
                    if (status === 'allow') {
                      Cookies.set('cookieConsent', 'true', { expires: 365 });
                    } else {
                      Cookies.set('cookieConsent', 'false', { expires: 365 });
                      disableTrackingScripts();
                    }
                  }
                });

                function disableTrackingScripts() {
                  // Remove Google Analytics scripts
                  const trackingScripts = document.querySelectorAll('script[data-cookie-consent="tracking"]');
                  trackingScripts.forEach(script => script.remove());

                  // Additional logic to disable tracking functions
                  window.gtag = function() {};
                  window.handleWebinarClick = function() {};
                  window.handleDocumentClick = function() {};
                  window.measureFirstTokenTime = function() {};
                }
              });
            `,
          }}
        ></script>
        <script
          type="text/plain"
          data-cookie-consent="tracking"
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-LRZR96PT9B"
        ></script>
        <script
          type="text/plain"
          data-cookie-consent="tracking"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-LRZR96PT9B');
            `,
          }}
        ></script>
        <noscript>
          Free cookie consent management tool by <a href="https://www.termsfeed.com/">TermsFeed</a>
        </noscript>
        {/* End Cookie Consent by TermsFeed */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
