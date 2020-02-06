
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module'
  },
  extends: [
    'eslint:recommended',
    "plugin:promise/recommended",
  ],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
//  plugins: [
//    "promise"
//  ],
  rules: {
    "promise/always-return": 0,
//    "no-debugger": 0,
//  	"no-console": 0,
//  	"no-mixed-spaces-and-tabs": 0,
  }
};
