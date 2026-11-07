// Leser app.json og legger til baseUrl for nettversjonen på GitHub Pages (EXPO_BASE_URL=/Skiglede/app). Uten variabelen er alt som før.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}) },
});
