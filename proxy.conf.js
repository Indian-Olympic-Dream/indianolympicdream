const PROXY_CONFIG = {
  "/api/graphql": {
    target: "http://localhost:3000",
    secure: false,
    changeOrigin: true,
  },
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
  "/api": {
    target: "https://iodsports.com",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
  },
};
module.exports = PROXY_CONFIG;
