import antfu from '@antfu/eslint-config';

export default antfu(
  {
    nextjs: true,
    typescript: true,
    lessOpinionated: true,
    isInEditor: false,
    stylistic: {
      semi: true,
    },
  },
  {
    rules: {
      'style/brace-style': ['error', '1tbs'],
      'ts/consistent-type-definitions': ['error', 'type'],
      'node/prefer-global/process': 'off',
    },
  },
);
