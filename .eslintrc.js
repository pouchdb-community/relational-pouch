
module.exports = {
  root: true,
  parserOptions: {
//    ecmaVersion: 2017,
    sourceType: 'module',
//    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
//    'eslint:recommended',
//    'plugin:@typescript-eslint/eslint-recommended',
//    'plugin:@typescript-eslint/recommended',
//    "plugin:@typescript-eslint/recommended-requiring-type-checking",
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
    "@typescript-eslint/no-floating-promises": "error",
//    "await-promise": 2,
//    "no-debugger": 0,
//  	"no-console": 0,
//  	"no-mixed-spaces-and-tabs": 0,
  }
};
