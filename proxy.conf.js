const PROXY_CONFIG = {
  "/api/graphql": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  /*
   * Media comes from the LOCAL backend, not production.
   *
   * It used to point at iodsports.com, which works only while every file
   * already exists there. Anything uploaded locally — a new product photo, for
   * instance — 500s, because the request is sent to a server that has never
   * seen it. Run `pnpm dev:sync-prod-media` in iod-backend to pull the
   * production files down, and then one origin serves both.
   */
  "/api/media": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/athletes": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/sports": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/games-schedule": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/games-participations": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/users": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api/subscriptions": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  /*
   * The shop must hit the LOCAL backend. The catch-all below sends anything
   * unmatched to production, so without this entry a local checkout would post
   * to the live site — which has no shop endpoints, and is not somewhere test
   * payments belong. Specific keys must stay above the catch-all.
   */
  "/api/shop": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
  "/api": {
    target: "https://iodsports.com",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
  },
};
module.exports = PROXY_CONFIG;
