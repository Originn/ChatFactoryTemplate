// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Fonts and other head elements */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
        {/* Cookie Consent and Tracking */}
        <Script
          src="https://www.termsfeed.com/public/cookie-consent/4.1.0/cookie-consent.js"
          charSet="UTF-8"
          strategy="beforeInteractive"
        ></Script>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.1/js.cookie.min.js"
          strategy="beforeInteractive"
        ></Script>
      </Head>
      <body>
        <Main />
        <NextScript />
        {/* Load gtag.js */}
        <Script
          id="gtag-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var script = document.createElement('script');
                script.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}';
                script.async = true;
                script.setAttribute('data-cookie-consent', 'tracking');
                script.onload = function() {
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  window.gtag = gtag;
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    cookie_flags: 'SameSite=None;Secure',
                  });
                  gtag('event', 'session_start', {
                    session_id: Date.now().toString(),
                  });
                };
                document.head.appendChild(script);
              })();
            `,
          }}
        ></Script>
        {/* Cookie consent and tracking */}
        <Script
          id="cookie-consent-and-tracking"
          strategy="afterInteractive"
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
                    onInitialConsent: function(status) {
                      handleConsentChange(status);
                    },
                    onStatusChange: function(status) {
                      handleConsentChange(status);
                    }
                  });

                function handleConsentChange(status) {
                  if (cookieconsent.hasConsented('tracking')) {
                    enableTrackingScripts();
                  } else {
                    disableTrackingScripts();
                  }
                }

                function enableTrackingScripts() {
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  window.gtag = gtag;
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    cookie_flags: 'SameSite=None;Secure',
                  });
                }

                function disableTrackingScripts() {
                  const trackingScripts = document.querySelectorAll('script[data-cookie-consent="tracking"]');
                  trackingScripts.forEach(script => script.remove());
                  window.gtag = function() {}; // Override gtag to prevent errors
                  console.warn('Tracking scripts disabled.');
                }
              });
            `,
          }}
        ></Script>
        <noscript>
          Free cookie consent management tool by <a href="https://www.termsfeed.com/">TermsFeed</a>
        </noscript>
      </body>
    </Html>
  );
}
