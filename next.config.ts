import type { NextConfig } from "next";

const defaultUserKey =
  process.env.NEXT_PUBLIC_TAMBO_USER_KEY?.trim() || "orbital-operator";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_TAMBO_USER_KEY: defaultUserKey,
  },
};

export default nextConfig;
