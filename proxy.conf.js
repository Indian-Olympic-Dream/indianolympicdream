const PROXY_CONFIG = {
  "/api": {
    target: "https://api.iod-community.com",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
  },
};
module.exports = PROXY_CONFIG;
