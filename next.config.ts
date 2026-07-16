import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Existe um package-lock.json solto em C:\Users\lucas (resquício de um
  // `git init`/`npm install` na home). Sem fixar a raiz, o Turbopack elege
  // a home como workspace root e passa a varrer a pasta pessoal inteira.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
