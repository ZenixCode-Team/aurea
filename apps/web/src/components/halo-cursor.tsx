"use client";

import { useEffect, useRef } from "react";

/**
 * Halo do cursor — o rastro de luz da hero.
 *
 * Arquitetura lida do shader da própria oevra.com (bundle `_nuxt/DC_P54Ec.js`),
 * incluindo os valores dela. Não é um brilho seguindo o mouse: é um RASTRO
 * de 24 posições passadas, e cada uma desenha um blob próprio.
 *
 * Para cada ponto do rastro:
 * - `falloff = pow(1 - i/total, 1.8)` — os antigos enfraquecem e encolhem
 * - o raio é modulado pelo ÂNGULO por duas senoides (`wobble`), o que faz
 *   cada blob ter lóbulos em vez de ser um círculo. É daqui que vem o
 *   aspecto orgânico, e é o detalhe que nenhuma aproximação visual pega.
 * - núcleo, brilho e contorno próprios, somados um sobre o outro
 *
 * O resultado é composto em `mix-blend-mode: plus-lighter` por cima do
 * conteúdo — o brilho atravessa o texto.
 *
 * A oevra só monta esta camada quando existe ponteiro de verdade
 * (`(hover: none), (pointer: coarse)` → não renderiza). Fazemos igual: em
 * toque, o rastro não teria o que seguir.
 */

const TOTAL_RASTRO = 24;

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_posicao;
  varying vec2 v_uv;
  void main() {
    v_uv = a_posicao * 0.5 + 0.5;
    gl_Position = vec4(a_posicao, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 v_uv;

  uniform vec2  u_resolucao;
  uniform float u_tempo;
  uniform float u_presenca;

  uniform float u_tamanho;
  uniform float u_forca;
  uniform float u_brilhoForca;
  uniform float u_brilhoMul;
  uniform float u_organicoAmp;
  uniform float u_organicoFreq;
  uniform float u_ondulacaoVel;

  uniform vec3  u_cor;
  uniform vec3  u_corContorno;

  uniform float u_contornoInternoMul;
  uniform float u_contornoExternoMul;
  uniform float u_contornoOpacidade;

  uniform vec2 u_rastro[24];

  void main() {
    vec2 uv = v_uv * 2.0 - 1.0;
    float proporcao = u_resolucao.x / u_resolucao.y;
    uv.x *= proporcao;

    vec3 cor = vec3(0.0);
    float alfa = 0.0;

    for (int i = 0; i < 24; i++) {
      vec2 rel = uv - u_rastro[i];
      float R = length(rel);
      float angulo = atan(rel.y, rel.x);

      float queda = 1.0 - float(i) / float(24);
      queda = pow(queda, 1.8);

      float escalaTamanho = 0.8 + 0.5 * queda;

      // Raio modulado pelo angulo: duas harmonicas defasadas por indice.
      // E o que troca o circulo por uma massa com lobulos.
      float ondulacao = 0.7 * sin(angulo * u_organicoFreq + u_tempo * u_ondulacaoVel + float(i) * 0.3);
      ondulacao += 0.3 * sin(angulo * (u_organicoFreq * 2.0) - u_tempo * (u_ondulacaoVel * 1.35) + float(i) * 0.6);

      float lobulos = 1.0 + u_organicoAmp * ondulacao;
      float d = R / max(lobulos, 0.25);

      float tamanho = u_tamanho * escalaTamanho;

      float nucleo = smoothstep(tamanho * 0.01, 0.0, d);

      float interno = tamanho;
      float externo = tamanho * max(u_brilhoMul, 1.0);
      float brilho = smoothstep(externo, interno, d);

      float forcaBrilho = brilho * u_forca * u_brilhoForca * queda;
      float forcaNucleo = nucleo * u_forca * 0.2 * queda;

      cor = mix(cor, u_cor, forcaBrilho);
      cor += u_cor * forcaNucleo;
      alfa = max(alfa, forcaBrilho + forcaNucleo);

      // Contorno: define a borda do blob sem preencher.
      float e1 = tamanho * u_contornoInternoMul;
      float e2 = tamanho * u_contornoExternoMul;
      float contornoInterno = min(e1, e2);
      float contornoExterno = max(e1, e2);

      float contorno = smoothstep(contornoExterno, contornoInterno, d);
      float forcaContorno = contorno * u_contornoOpacidade * 0.3;
      if (i == 0) {
        forcaContorno = contorno * u_contornoOpacidade * queda;
      }

      cor = mix(cor, u_corContorno, forcaContorno);
      alfa = max(alfa, forcaContorno);
    }

    gl_FragColor = vec4(cor, alfa * u_presenca);
  }
`;

function compilar(
  gl: WebGLRenderingContext,
  tipo: number,
  fonte: string,
): WebGLShader | null {
  const shader = gl.createShader(tipo);
  if (!shader) return null;
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[halo-cursor] shader falhou:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HaloCursor({ className = "" }: { className?: string }) {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;

    // Em toque não há cursor a seguir, mas o halo continua: ele passa a
    // percorrer sozinho o próprio caminho. O efeito nunca some da tela.
    const temPonteiroFino = !window.matchMedia(
      "(hover: none), (pointer: coarse)",
    ).matches;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vs = compilar(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const programa = gl.createProgram();
    if (!programa) return;
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      console.error("[halo-cursor] link falhou:", gl.getProgramInfoLog(programa));
      return;
    }
    gl.useProgram(programa);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const localPos = gl.getAttribLocation(programa, "a_posicao");
    gl.enableVertexAttribArray(localPos);
    gl.vertexAttribPointer(localPos, 2, gl.FLOAT, false, 0, 0);

    const u = (nome: string) => gl.getUniformLocation(programa, nome);
    const uResolucao = u("u_resolucao");
    const uTempo = u("u_tempo");
    const uPresenca = u("u_presenca");
    const uRastro = u("u_rastro");

    // Valores lidos do bundle da oevra.
    gl.uniform1f(u("u_tamanho"), 0.12);
    gl.uniform1f(u("u_forca"), 1.3);
    gl.uniform1f(u("u_brilhoForca"), 0.1);
    gl.uniform1f(u("u_brilhoMul"), 4.0);
    gl.uniform1f(u("u_organicoAmp"), 0.4);
    gl.uniform1f(u("u_organicoFreq"), 1.0);
    gl.uniform1f(u("u_ondulacaoVel"), 1.2);
    gl.uniform1f(u("u_contornoInternoMul"), 1.7);
    gl.uniform1f(u("u_contornoExternoMul"), 0.85);
    gl.uniform1f(u("u_contornoOpacidade"), 0.9);
    // Luz levemente puxada para o lime do sistema, em vez do branco puro.
    gl.uniform3fv(u("u_cor"), [0.96, 1.0, 0.83]);
    gl.uniform3fv(u("u_corContorno"), [0.06, 0.1, 0.05]);

    const dprMaximo = 1.5;
    const ESCALA = 0.55;
    let proporcao = 1;

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprMaximo);
      const largura = Math.max(1, Math.floor(canvas.clientWidth * dpr * ESCALA));
      const altura = Math.max(1, Math.floor(canvas.clientHeight * dpr * ESCALA));
      if (canvas.width === largura && canvas.height === altura) return;
      canvas.width = largura;
      canvas.height = altura;
      proporcao = largura / altura;
      gl.viewport(0, 0, largura, altura);
      gl.uniform2f(uResolucao, largura, altura);
    };
    redimensionar();
    const observador = new ResizeObserver(redimensionar);
    observador.observe(canvas);

    // Rastro em corrente: o primeiro ponto persegue o cursor, e cada
    // seguinte persegue o anterior. É o que produz a cauda contínua em
    // vez de pontos soltos amostrados por evento.
    const rastro = new Float32Array(TOTAL_RASTRO * 2);
    for (let i = 0; i < TOTAL_RASTRO; i++) {
      rastro[i * 2] = 0;
      rastro[i * 2 + 1] = 0;
    }

    const alvoCursor = { x: 0, y: 0 };
    let presenca = 0;
    // Quanto do alvo vem do cursor. Cai sozinho quando o mouse para, e o
    // caminho autônomo reassume — sem salto, porque a mistura é contínua.
    let peso = 0;
    let ultimoMovimento = -Infinity;

    const aoMover = (evento: PointerEvent) => {
      if (!temPonteiroFino) return;
      const caixa = canvas.getBoundingClientRect();
      const nx = (evento.clientX - caixa.left) / caixa.width;
      const ny = (evento.clientY - caixa.top) / caixa.height;
      // Mesmo espaço do shader: [-1,1] com x corrigido pela proporção.
      alvoCursor.x = (nx * 2 - 1) * proporcao;
      alvoCursor.y = (1 - ny) * 2 - 1;
      ultimoMovimento = performance.now();
    };

    if (temPonteiroFino) {
      window.addEventListener("pointermove", aoMover, { passive: true });
    }

    let quadro = 0;
    let visivel = true;
    const inicio = performance.now();

    const desenhar = (agora: number) => {
      const t = (agora - inicio) / 1000;
      gl.uniform1f(uTempo, t);

      // Entra suave no primeiro segundo e não sai mais: o efeito faz parte
      // da hero, não é resposta a interação.
      presenca += (1 - presenca) * 0.03;
      gl.uniform1f(uPresenca, presenca);

      // Caminho autônomo. Períodos incomensuráveis entre si — o desenho
      // nunca fecha um ciclo e nunca repete o mesmo traço.
      const autoX = Math.sin(t * 0.21) * 0.62 * proporcao +
        Math.sin(t * 0.089 + 1.7) * 0.3 * proporcao;
      const autoY = Math.cos(t * 0.157) * 0.5 + Math.sin(t * 0.067 + 0.6) * 0.22;

      // O cursor assume o alvo enquanto se move e devolve o comando ao
      // caminho autônomo depois de parado.
      const paradoHa = (agora - ultimoMovimento) / 1000;
      const alvoPeso = paradoHa < 1.4 ? 1 : 0;
      peso += (alvoPeso - peso) * (alvoPeso > peso ? 0.12 : 0.012);

      const alvoX = autoX + (alvoCursor.x - autoX) * peso;
      const alvoY = autoY + (alvoCursor.y - autoY) * peso;

      // Corrente mais frouxa que antes: a cabeça persegue devagar e os
      // elos ficam mais soltos, o que estica a cauda em vez de amontoar.
      rastro[0] += (alvoX - rastro[0]) * 0.085;
      rastro[1] += (alvoY - rastro[1]) * 0.085;
      for (let i = 1; i < TOTAL_RASTRO; i++) {
        // Elos do fim seguem um pouco mais devagar — a cauda abre.
        const passo = 0.19 - (i / TOTAL_RASTRO) * 0.07;
        rastro[i * 2] += (rastro[(i - 1) * 2] - rastro[i * 2]) * passo;
        rastro[i * 2 + 1] += (rastro[(i - 1) * 2 + 1] - rastro[i * 2 + 1]) * passo;
      }
      gl.uniform2fv(uRastro, rastro);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (visivel) quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);

    const observadorVisibilidade = new IntersectionObserver(
      ([entrada]) => {
        const agoraVisivel = entrada.isIntersecting && !document.hidden;
        if (agoraVisivel && !visivel) {
          visivel = true;
          quadro = requestAnimationFrame(desenhar);
        } else {
          visivel = agoraVisivel;
        }
      },
      { threshold: 0 },
    );
    observadorVisibilidade.observe(canvas);

    return () => {
      visivel = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      observadorVisibilidade.disconnect();
      window.removeEventListener("pointermove", aoMover);
      gl.deleteProgram(programa);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <canvas ref={refCanvas} className="h-full w-full" />
    </div>
  );
}
