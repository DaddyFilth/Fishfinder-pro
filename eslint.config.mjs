import nextConfig from "eslint-config-next";
import nextTypeScriptConfig from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
      ".git/**",
      "dist/**",
    ],
  },
  ...nextConfig,
  ...nextTypeScriptConfig,
];

export default config;
