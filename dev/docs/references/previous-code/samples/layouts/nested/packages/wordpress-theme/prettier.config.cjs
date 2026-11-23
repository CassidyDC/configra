module.exports = {
  ...{
    useTabs: false,
    tabWidth: 2,
    endOfLine: "lf",
    printWidth: 100,
    overrides: [
      {
        files: "**/*.css",
        options: {
          useTabs: true,
          tabWidth: 4,
          endOfLine: "lf",
          printWidth: 100,
          singleQuote: false,
        },
      },
      {
        files: "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}",
        options: {
          useTabs: false,
          tabWidth: 2,
          endOfLine: "lf",
          printWidth: 100,
        },
      },
    ],
  },
};
