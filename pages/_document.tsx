import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
        <Script
          src="https://www.termsfeed.com/public/cookie-consent/4.1.0/cookie-consent.js"
          charSet="UTF-8"
          strategy="beforeInteractive"
        ></Script>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.1/js.cookie.min.js"
          strategy="beforeInteractive"
        ></Script>
        <Script
          id="cookie-consent-script"
          strategy="beforeInteractive"
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
                  if (!cookieconsent.hasConsented('tracking')) {
                    disableTrackingScripts();
                  }
                }

                function disableTrackingScripts() {
                  const trackingScripts = document.querySelectorAll('script[data-cookie-consent="tracking"]');
                  trackingScripts.forEach(script => script.remove());

                  window.gtag = function() {};
                  window.handleWebinarClick = function() {};
                  window.handleDocumentClick = function() {};
                  window.measureFirstTokenTime = function() {};
                }
              });
            `,
          }}
        ></Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LRZR96PT9B"
          strategy="afterInteractive"
          data-cookie-consent="tracking"
        ></Script>
        <Script
          id="google-analytics-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-LRZR96PT9B');
            `,
          }}
        ></Script>
        <noscript>
          Free cookie consent management tool by <a href="https://www.termsfeed.com/">TermsFeed</a>
        </noscript>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
