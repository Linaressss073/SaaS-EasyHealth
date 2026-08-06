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
    // lefthook.yml lives at the monorepo root, outside this package, so knip
    // (scoped to identity-patient/) can't see that the binary is used from there.
    'lefthook',
  ],
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['tests/**/*.@(integ|e2e).ts'],
  },
  compilers: {
    css: text => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
  // Left off: knip's "remove this from ignoreDependencies" hint for `lefthook`
  // flip-flops between machines (its usage detection depends on local .git/hooks
  // state, which differs between a dev machine and a fresh CI checkout).
  // Real unused-dependency/file findings still fail the check either way.
};

export default config;
