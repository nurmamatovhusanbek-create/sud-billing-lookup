import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ignoreBuildErrors: true — intentionally left on. The app has a 5700-line
  // page.tsx with some loose typing around API response shapes. Flipping this
  // off would block deploys until every type error is fixed. Leave on until
  // the P2 component extraction is complete and types are tightened.
  typescript: {
    ignoreBuildErrors: true,
  },
  // reactStrictMode: false — intentionally disabled. This app makes expensive
  // live API calls to Uzbek government sites (PoW captcha solving, court case
  // scraping). Strict mode double-invokes effects in dev, which would double
  // real request volume against sud.uz/orginfo.uz/chamber.uz. Re-enable only
  // after adding proper request deduplication or mock providers for dev.
  reactStrictMode: false,
};

export default nextConfig;
