const config = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/components/ui/*',
    'src/libs/DB.ts',
    'src/libs/I18n.ts',
    'src/libs/Logger.ts',
    'src/types/Auth.ts',
    'src/utils/DBConnection.ts',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@logtape/logtape',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
    // Invoked directly via CI workflows, not imported from identity-patient's own source.
    'checkly',
    'semantic-release',
  ],
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['tests/**/*.@(integ|e2e).ts'],
  },
  compilers: {
    css: text => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
