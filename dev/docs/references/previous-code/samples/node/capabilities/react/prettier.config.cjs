module.exports = {
  ...{
    useTabs: false,
    tabWidth: 2,
    endOfLine: "lf",
    printWidth: 100,
    overrides: [
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
