module.exports = {
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    browser: true,
    es2022: true
  },
  plugins: ["react"],
  rules: {
    "no-undef": "error",
    "react/jsx-uses-react": "error",
    "react/jsx-uses-vars": "error"
  }
};
