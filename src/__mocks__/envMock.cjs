// CommonJS-safe stand-in for src/apis/env.ts under Jest, which cannot parse
// `import.meta`. Tests resolve API URLs against this fixed origin.
module.exports = {
  getApiBaseUrl: () => 'http://localhost:3001',
};
