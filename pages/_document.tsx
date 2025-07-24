// pages/_document.tsx
import { Html, Head, Main, NextScript, DocumentProps, DocumentContext } from "next/document";
import Document from "next/document";
import Script from "next/script";
import createEmotionServer from '@emotion/server/create-instance';
import createEmotionCache from '../utils/createEmotionCache';
import { getTemplateConfig } from '../config/template';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

interface MyDocumentProps extends DocumentProps {
  emotionStyleTags: JSX.Element[];
}

export default function MyDocument({ emotionStyleTags }: MyDocumentProps) {
  const config = getTemplateConfig();

  return (
    <Html lang="en">
      <Head>
        {/* Dynamic Favicon and App Icons */}
        <link rel="icon" type="image/x-icon" href={config.favicon.iconUrl} />
        <link rel="shortcut icon" type="image/x-icon" href={config.favicon.iconUrl} />
        <link rel="icon" type="image/png" sizes="32x32" href={config.favicon.iconUrl} />
        <link rel="icon" type="image/png" sizes="16x16" href={config.favicon.iconUrl} />
        <link rel="apple-touch-icon" sizes="180x180" href={config.favicon.appleTouchIconUrl} />
        <link rel="manifest" href="/api/manifest" />
        <meta name="theme-color" content={config.favicon.themeColor} />
        <meta name="msapplication-TileColor" content={config.favicon.themeColor} />
        <meta name="msapplication-config" content="/api/browserconfig" />
        
        {/* Emotion insertion point for MUI styles */}
        <meta name="emotion-insertion-point" content="" />
        {/* Inject emotion styles */}
        {emotionStyleTags}
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
                    "website_name": "AI Assistant",
                    "website_privacy_policy_url": "/privacy-policy",
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

// getInitialProps for server-side emotion extraction
MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  const originalRenderPage = ctx.renderPage;

  // You can consider sharing the same Emotion cache between all the SSR requests to speed up performance.
  // However, be aware that it can have global side effects.
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App: any) =>
        function EnhanceApp(props) {
          return <App emotionCache={cache} {...props} />;
        },
    });

  const initialProps = await Document.getInitialProps(ctx);
  // This is important. It prevents Emotion to render invalid HTML.
  // See https://github.com/mui/material-ui/issues/26561#issuecomment-855286153
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style) => (
    <style
      data-emotion={`${style.key} ${style.ids.join(' ')}`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  return {
    ...initialProps,
    emotionStyleTags,
  };
};
