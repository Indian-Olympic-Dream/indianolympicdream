import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const static50xPagePath = resolve(browserDistFolder, '50x.html');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Serve static files from /browser
 */
app.use(
    express.static(browserDistFolder, {
        maxAge: '1y',
        index: false,
        redirect: false,
    }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
    angularApp
        .handle(req)
        .then((response) =>
            response ? writeResponseToNodeResponse(response, res) : next(),
        )
        .catch(next);
});

app.use(async (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('SSR render failure', error);
    try {
        const html = await readFile(static50xPagePath, 'utf8');
        res.status(500).type('html').send(html);
        return;
    } catch {
        res
            .status(500)
            .type('html')
            .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Server Error | Indian Olympic Dream</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(167, 84, 60, 0.16), transparent 38%),
          linear-gradient(180deg, #090b11 0%, #11131b 52%, #0b0d13 100%);
        color: #f5f1e8;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .panel {
        width: min(760px, 100%);
        padding: 32px;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
          rgba(9, 11, 17, 0.82);
        box-shadow: 0 36px 96px rgba(0, 0, 0, 0.42);
      }
      .mark {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 24px;
      }
      .logo-wrap {
        width: 86px;
        height: 86px;
        display: grid;
        place-items: center;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(167, 84, 60, 0.32);
      }
      .logo {
        width: 56px;
        height: 56px;
        object-fit: contain;
      }
      .code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: clamp(3rem, 9vw, 5.5rem);
        line-height: 0.9;
        letter-spacing: -0.08em;
        color: rgba(245, 172, 130, 0.92);
      }
      .kicker {
        margin: 0 0 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.76rem;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.56);
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 3.2rem);
        line-height: 1.02;
      }
      p {
        margin: 16px 0 0;
        max-width: 54ch;
        font-size: 1rem;
        line-height: 1.72;
        color: rgba(255, 255, 255, 0.72);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }
      .action {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: #f5f1e8;
        text-decoration: none;
        font-weight: 600;
      }
      .action-primary {
        border-color: transparent;
        background: linear-gradient(135deg, #c67a52 0%, #f3b189 100%);
        color: #11131b;
      }
      @media (max-width: 700px) {
        .panel { padding: 24px 20px; }
        .mark { flex-direction: column; align-items: flex-start; }
        .actions { flex-direction: column; }
        .action { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="mark">
        <div class="logo-wrap">
          <img class="logo" src="/assets/images/logo.png" alt="Indian Olympic Dream logo" />
        </div>
        <span class="code">500</span>
      </div>
      <p class="kicker">Service Unavailable</p>
      <h1>We cannot load this page right now.</h1>
      <p>Our server is temporarily unavailable or taking longer than expected to respond. Please try again shortly or return to the home page.</p>
      <div class="actions">
        <a class="action action-primary" href="/">Go Home</a>
        <a class="action" href="/calendar">Open Calendar</a>
      </div>
    </main>
  </body>
</html>`);
    }
});

/**
 * Start the server if this module is the main entry point.
 */
if (isMainModule(import.meta.url)) {
    const port = process.env['PORT'] || 4000;
    app.listen(port, () => {
        console.log(`Node Express server listening on http://localhost:${port}`);
    });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);
