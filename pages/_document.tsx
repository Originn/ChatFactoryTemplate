import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Your existing code */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.1/js.cookie.min.js"
          strategy="beforeInteractive"
        ></Script>
        {/* Remove the gtag.js script from here */}
        {/* ... */}
      </Head>
      <body>
        <Main />
        <NextScript />
        {/* Move the gtag.js script here */}
        <Script
          id="gtag-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const isInIframe = window !== window.parent;

                if (!isInIframe) {
                  // Load gtag.js only if not in iframe
                  var script = document.createElement('script');
                  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-LRZR96PT9B';
                  script.async = true;
                  document.head.appendChild(script);
                }
              })();
            `,
          }}
        ></Script>
        <Script
          id="cookie-consent-and-tracking"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('DOMContentLoaded', function () {
                const isInIframe = window !== window.parent;

                if (isInIframe) {
                  // Automatically accept cookies in iframe
                  Cookies.set('cookie_consent_user_accepted', 'true', { expires: 365 });
                  Cookies.set('cookieconsent_status', 'allow', { expires: 365 });

                  // Load gtag.js dynamically
                  var script = document.createElement('script');
                  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-LRZR96PT9B';
                  script.async = true;
                  script.onload = function() {
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', 'G-LRZR96PT9B');
                    console.log('Google Analytics initialized in iframe.');
                  };
                  document.head.appendChild(script);
                } else {
                  // Display cookie banner on main website
                  cookieconsent.run({
                    // Your cookie consent configurations
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
                    gtag('config', 'G-LRZR96PT9B');
                    console.log('Google Analytics initialized on main website.');
                  }

                  function disableTrackingScripts() {
                    // Disable tracking scripts
                    window.gtag = function() {}; // Override gtag to prevent errors
                    console.warn('Tracking scripts disabled.');
                  }
                }
              });
            `,
          }}
        ></Script>
        {/* Remove the existing gtag.js script tag */}
      </body>
    </Html>
  );
}
