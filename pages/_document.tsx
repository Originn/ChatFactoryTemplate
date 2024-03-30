//pages/_documents.tsx
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
        </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
