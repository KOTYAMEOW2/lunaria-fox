import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "source_bundle/**",
      "release_bundle*/**",
      "blockbench-app-extract/**",
      "fabricmc-net-src/**",
      "lrarmor-fabric-port/**",
      "lrarmor-port-work/**",
      "scp-fabric-mod/**",
      "tmp_*/**",
    ],
  },
];

export default config;
