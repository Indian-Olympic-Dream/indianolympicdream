const PROXY_CONFIG ={
  "/api/content": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug",
    "pathRewrite": {
      "^/api/content": "/api"
    }
  },
  "/api": {
    "target": "https://api.iod-community.com",
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
module.exports = PROXY_CONFIG;