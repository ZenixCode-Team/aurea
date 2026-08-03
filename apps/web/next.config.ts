import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `noindex` também no cabeçalho, não só na meta tag do `layout.tsx`.
   *
   * A meta tag cobre página HTML. O cabeçalho cobre o resto — imagem, JSON, qualquer
   * resposta que um robô alcance por link direto e que não tem `<head>` onde declarar
   * intenção.
   *
   * Vale para toda rota enquanto o AUREA for ambiente de demonstração com limiar não
   * validado clinicamente. A justificativa por extenso está em `app/layout.tsx`.
   */
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
