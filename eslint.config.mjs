import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "source_bundle/**",
      "release_bundle*/**",
    ],
  },
];

export default config;
