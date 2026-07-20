import path from "node:path";
import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Existe um package-lock.json solto em C:\Users\lucas (resquício de um
  // `git init`/`npm install` na home). Sem fixar a raiz, o Turbopack elege
  // a home como workspace root e passa a varrer a pasta pessoal inteira.
  turbopack: { root: path.resolve(__dirname) },

  images: {
    // Libera o storage do Supabase para o otimizador do Next. Sem isto seria
    // preciso `unoptimized`, que serve a imagem no tamanho físico exato — em
    // tela retina (2x/3x) o avatar sai borrado e sem srcset.
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/**" }]
      : [],
  },
};

export default nextConfig;
