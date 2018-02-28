module.exports = 
{
  extends: [ 'eslint:recommended', 'prettier' ],
  plugins: ['prettier' ], // activating esling-plugin-prettier (--fix stuff)
  env: {
    browser: true,
    node: true,
    es6: true
  },
  rules: {
    'prettier/prettier': [
      // customizing prettier rules (unfortunately not many of them are customizable)
      'error',
      {
        singleQuote: true,
        semi: false
      }
    ],
    'semi': ['error', 'never' ],
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-inner-declarations': 'off'
  }
}
