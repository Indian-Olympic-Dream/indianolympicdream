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
  "/api": {
    target: "http://localhost:3001",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
  },
};
module.exports = PROXY_CONFIG;
