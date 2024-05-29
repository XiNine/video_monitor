module.exports = {
  parserOptions: {
    ecmaVersion: 7,
    sourceType: "module",
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "space-before-function-paren": 0,
  },
};
