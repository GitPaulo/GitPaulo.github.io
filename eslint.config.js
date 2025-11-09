import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: ["node_modules/", "build/", "dist/", "*.min.js"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        A11yDialog: "readonly",
        pdfjsLib: "readonly",
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...eslintConfigPrettier.rules,
      "prettier/prettier": "error",
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
];
