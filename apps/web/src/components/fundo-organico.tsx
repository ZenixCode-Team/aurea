"use client";

import { useEffect, useRef } from "react";

/**
 * Fundo orgânico em WebGL — duas camadas, como na ref oevra.com.
 *
 * A arquitetura veio da leitura do shader da própria oevra (bundle Nuxt
 * `_nuxt/DC_P54Ec.js`), não de aproximação visual:
 *
 * - quatro círculos suaves (`circuloSuave`), cada um com centro, raio,
 *   suavidade, fase e COR própria, misturados em sequência sobre a cor de
 *   fundo. Não é ruído fractal — são massas limpas que se sobrepõem.
 * - o centro de cada círculo é deslocado por um campo senoidal, com
 *   frequência e velocidade próprias. É isso que faz a massa ondular em
 *   vez de orbitar em círculo.
 * - uma deriva global lentíssima aplicada ao UV inteiro.
 * - dois realces aditivos e uma vinheta discreta.
 *
 * O mesmo campo serve a hero e às três seções da escala, trocando só a
 * paleta — é o que faz o verde do site ser um só. O brilho que passa por
 * cima do texto é outra camada, em `halo-cursor.tsx`.
 *
 * Movimento reduzido: ao contrário da oevra, que anima sempre, aqui a
 * deriva cai para um quarto da velocidade e o cursor é desligado. Uma
 * massa de cor derivando devagar não é gatilho vestibular — o que é
 * gatilho são transformações grandes, e essas ficam desativadas.
 */

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
  uniform vec2  u_cursor;
  uniform float u_cursorForca;

  uniform vec3  u_fundo;
  uniform vec3  u_base1, u_base2, u_base3, u_base4;
  uniform float u_opacidades[4];
  uniform float u_escalas[4];

  uniform float u_deriva;
  uniform float u_deslocForca;
  uniform float u_deslocFreq;
  uniform float u_deslocVel;
  uniform float u_grao;
  uniform float u_realce;

  float hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p.x + p.y) * 43758.5453123);
  }

  // Massa suave com centro deslocado por campo senoidal.
  // O deslocamento e o que impede a massa de parecer um circulo.
  float circuloSuave(vec2 p, vec2 centro, float raio, float suavidade, float fase) {
    vec2 deslocamento = vec2(
      sin(p.x * u_deslocFreq + u_tempo * u_deslocVel + fase) * 1.0 +
      sin(p.y * u_deslocFreq * 1.3 - u_tempo * u_deslocVel * 0.8 + fase * 1.3) * 0.6,
      cos(p.y * u_deslocFreq + u_tempo * u_deslocVel * 1.2 + fase * 0.7) * 0.8 +
      cos(p.x * u_deslocFreq * 0.7 + u_tempo * u_deslocVel * 0.6 + fase * 1.5) * 0.4
    );

    vec2 centroDeslocado = centro + deslocamento * u_deslocForca;
    return smoothstep(raio, raio - suavidade, length(p - centroDeslocado));
  }

  void main() {
    vec2 uv = v_uv * 2.0 - 1.0;
    float proporcao = u_resolucao.x / u_resolucao.y;
    uv.x *= proporcao;

    vec2 deriva = vec2(
      sin(u_tempo * 0.06 * u_deriva),
      cos(u_tempo * 0.04 * u_deriva)
    ) * 0.06;
    vec2 U = uv + deriva;

    vec3 camada = u_fundo;

    float m1 = circuloSuave(U, vec2(-0.55 * proporcao, -0.20), 1.20 * u_escalas[0], 0.85, 0.00) * u_opacidades[0];
    float m2 = circuloSuave(U, vec2( 0.15 * proporcao,  0.05), 0.80 * u_escalas[1], 0.55, 1.57) * u_opacidades[1];
    float m3 = circuloSuave(U, vec2( 0.65 * proporcao,  0.15), 0.90 * u_escalas[2], 0.60, 3.14) * u_opacidades[2];
    float m4 = circuloSuave(U, vec2(-0.10 * proporcao,  0.55), 0.55 * u_escalas[3], 0.45, 4.71) * u_opacidades[3];

    camada = mix(camada, u_base1, m1);
    camada = mix(camada, u_base2, m2);
    camada = mix(camada, u_base3, m3);
    camada = mix(camada, u_base4, m4);

    // Quinta massa: segue o cursor. Some junto com as outras no halo.
    vec2 cursor = vec2((u_cursor.x * 2.0 - 1.0) * proporcao, u_cursor.y * 2.0 - 1.0);
    float mc = circuloSuave(U, cursor, 0.62, 0.5, 2.4) * u_cursorForca;
    camada = mix(camada, u_base3, mc * 0.85);

    // Realces aditivos: levantam duas regioes sem lavar o quadro inteiro.
    float r1 = smoothstep(0.45, 0.0, length(U - vec2(0.25 * proporcao, -0.10)));
    float r2 = smoothstep(0.55, 0.0, length(U - vec2(0.70 * proporcao,  0.35)));
    camada += vec3(0.10, 0.12, 0.10) * (r1 * 0.35 + r2 * 0.25) * u_realce;

    float vinheta = smoothstep(1.25, 0.25, length(U));
    camada *= mix(0.94, 1.0, vinheta);

    // Grao fino: tira o aspecto de degrade puro.
    camada += (hash(v_uv * u_resolucao) - 0.5) * u_grao;

    gl_FragColor = vec4(camada, 1.0);
  }
`;

type Rgb = [number, number, number];
type Quatro = [number, number, number, number];

interface PropsFundoOrganico {
  /** Preset cromático da seção. Default: o verde da hero. */
  paleta?: PaletaNome;
  fundo?: Rgb;
  base1?: Rgb;
  base2?: Rgb;
  base3?: Rgb;
  base4?: Rgb;
  opacidades?: Quatro;
  escalas?: Quatro;
  className?: string;
}

export type PaletaNome = "azul" | "verde" | "ambar" | "vermelho";

/**
 * Presets cromáticos do campo.
 *
 * `azul` é o campo de MARCA: painéis laterais de consentimento, recuperação de
 * acesso e primeiro acesso. Existe porque essas três telas usavam a paleta
 * `verde` como decoração, e `verde` aqui é a faixa "está tudo bem" da escala.
 * Cor com significado clínico não decora (lei inviolável 1).
 *
 * `verde`, `ambar` e `vermelho` são a ESCALA, e vivem na seção "As cores". Não
 * acompanharam a virada da marca para o azul, e não devem: ali a cor É o
 * conteúdo.
 *
 * A amplitude das paletas de seção é menor que a da hero de propósito: nas
 * seções o texto é lido por cima do campo, e vale de luminância largo
 * derruba o contraste em algum ponto da animação.
 */
export const PALETAS: Record<
  PaletaNome,
  {
    fundo: Rgb;
    base1: Rgb;
    base2: Rgb;
    base3: Rgb;
    base4: Rgb;
    opacidades: Quatro;
    escalas: Quatro;
  }
> = {
  azul: {
    fundo: [0.075, 0.455, 0.706], // #1374B4
    base1: [0.035, 0.114, 0.165], // #091d2a vale escuro
    base2: [0.078, 0.302, 0.443], // #144d71
    base3: [0.659, 0.812, 0.91], // #a8cfe8 crista clara
    base4: [0.051, 0.212, 0.322], // #0d3652
    opacidades: [0.95, 0.85, 0.8, 0.7],
    escalas: [1, 1, 1, 1],
  },
  verde: {
    fundo: [0.478, 0.545, 0.325], // #7a8b53
    base1: [0.33, 0.4, 0.22], // #546638 vale escuro
    base2: [0.639, 0.706, 0.478], // #a3b47a
    base3: [0.812, 0.855, 0.686], // #cfdaaf crista clara
    base4: [0.408, 0.482, 0.267], // #687b44
    opacidades: [0.95, 0.85, 0.8, 0.7],
    escalas: [1, 1, 1, 1],
  },
  ambar: {
    fundo: [0.91, 0.639, 0.239], // #e8a33d
    base1: [0.788, 0.529, 0.149], // #c98726
    base2: [0.949, 0.745, 0.431], // #f2be6e
    base3: [0.969, 0.839, 0.624], // #f7d69f
    base4: [0.867, 0.604, 0.2], // #dd9a33
    opacidades: [0.9, 0.8, 0.72, 0.62],
    escalas: [1, 1, 1, 1],
  },
  vermelho: {
    fundo: [0.761, 0.271, 0.176], // #c2452d
    base1: [0.627, 0.212, 0.129], // #a03621
    base2: [0.831, 0.4, 0.298], // #d4664c
    base3: [0.878, 0.541, 0.447], // #e08a72
    base4: [0.71, 0.247, 0.157], // #b53f28
    opacidades: [0.9, 0.8, 0.72, 0.62],
    escalas: [1, 1, 1, 1],
  },
};

/* Reserva em CSS por paleta, para o caso de o contexto WebGL não existir. */
const RESERVA: Record<PaletaNome, string> = {
  azul: "radial-gradient(120% 90% at 30% 65%, #a8cfe8 0%, #1374B4 45%, #091d2a 100%)",
  verde:
    "radial-gradient(120% 90% at 30% 65%, #cfdaaf 0%, #7a8b53 45%, #546638 100%)",
  ambar:
    "radial-gradient(120% 90% at 30% 65%, #f7d69f 0%, #e8a33d 45%, #c98726 100%)",
  vermelho:
    "radial-gradient(120% 90% at 30% 65%, #e08a72 0%, #c2452d 45%, #a03621 100%)",
};


function compilarShader(
  gl: WebGLRenderingContext,
  tipo: number,
  fonte: string,
): WebGLShader | null {
  const shader = gl.createShader(tipo);
  if (!shader) return null;
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[fundo-organico] shader falhou:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function FundoOrganico({
  paleta = "verde",
  className = "",
  ...sobrescritas
}: PropsFundoOrganico) {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vs = compilarShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compilarShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const programa = gl.createProgram();
    if (!programa) return;
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      console.error("[fundo-organico] link falhou:", gl.getProgramInfoLog(programa));
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
    const localPosicao = gl.getAttribLocation(programa, "a_posicao");
    gl.enableVertexAttribArray(localPosicao);
    gl.vertexAttribPointer(localPosicao, 2, gl.FLOAT, false, 0, 0);

    const preset = PALETAS[paleta];
    const cfg = { ...preset, ...sobrescritas };

    const local = (nome: string) => gl.getUniformLocation(programa, nome);
    const uResolucao = local("u_resolucao");
    const uTempo = local("u_tempo");
    const uCursor = local("u_cursor");
    const uCursorForca = local("u_cursorForca");

    gl.uniform3fv(local("u_fundo"), cfg.fundo);
    gl.uniform3fv(local("u_base1"), cfg.base1);
    gl.uniform3fv(local("u_base2"), cfg.base2);
    gl.uniform3fv(local("u_base3"), cfg.base3);
    gl.uniform3fv(local("u_base4"), cfg.base4);
    gl.uniform1fv(local("u_opacidades"), cfg.opacidades);
    gl.uniform1fv(local("u_escalas"), cfg.escalas);

    const prefereMenosMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Valores lidos do bundle da oevra. O deslocamento é o parâmetro que
    // mais muda o resultado: com 0.075 o campo fica morto; 0.8 é o valor
    // real deles e é o que faz a massa ondular de verdade.
    const fator = prefereMenosMovimento ? 0.25 : 1;
    gl.uniform1f(local("u_deriva"), 1.0 * fator);
    gl.uniform1f(local("u_deslocForca"), 0.8);
    gl.uniform1f(local("u_deslocFreq"), 1.0);
    gl.uniform1f(local("u_deslocVel"), 0.6 * fator);
    gl.uniform1f(local("u_grao"), 0.012);
    gl.uniform1f(local("u_realce"), 1);

    const ESCALA = 0.6;
    const dprMaximo = 1.5;

    const redimensionar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprMaximo);
      const largura = Math.max(1, Math.floor(canvas.clientWidth * dpr * ESCALA));
      const altura = Math.max(1, Math.floor(canvas.clientHeight * dpr * ESCALA));
      if (canvas.width === largura && canvas.height === altura) return;
      canvas.width = largura;
      canvas.height = altura;
      gl.viewport(0, 0, largura, altura);
      gl.uniform2f(uResolucao, largura, altura);
    };

    redimensionar();
    const observador = new ResizeObserver(redimensionar);
    observador.observe(canvas);

    const alvoCursor = { x: 0.5, y: 0.5 };
    const suaveCursor = { x: 0.5, y: 0.5 };
    let forcaCursor = 0;

    const aoMover = (evento: PointerEvent) => {
      const caixa = canvas.getBoundingClientRect();
      alvoCursor.x = (evento.clientX - caixa.left) / caixa.width;
      alvoCursor.y = 1 - (evento.clientY - caixa.top) / caixa.height;
      forcaCursor = 1;
    };
    const aoSair = () => {
      forcaCursor = 0;
    };

    if (!prefereMenosMovimento) {
      window.addEventListener("pointermove", aoMover, { passive: true });
      window.addEventListener("pointerleave", aoSair, { passive: true });
    }

    let quadro = 0;
    let visivel = true;
    const inicio = performance.now();

    const desenhar = (agora: number) => {
      gl.uniform1f(uTempo, (agora - inicio) / 1000);

      suaveCursor.x += (alvoCursor.x - suaveCursor.x) * 0.05;
      suaveCursor.y += (alvoCursor.y - suaveCursor.y) * 0.05;
      gl.uniform2f(uCursor, suaveCursor.x, suaveCursor.y);
      gl.uniform1f(
        uCursorForca,
        prefereMenosMovimento ? 0 : forcaCursor * 0.6,
      );

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

    const aoTrocarAba = () => {
      const agoraVisivel = !document.hidden;
      if (agoraVisivel && !visivel) {
        visivel = true;
        quadro = requestAnimationFrame(desenhar);
      } else {
        visivel = agoraVisivel;
      }
    };
    document.addEventListener("visibilitychange", aoTrocarAba);

    return () => {
      visivel = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      observadorVisibilidade.disconnect();
      document.removeEventListener("visibilitychange", aoTrocarAba);
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerleave", aoSair);
      gl.deleteProgram(programa);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paleta]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ background: RESERVA[paleta] }}
    >
      <canvas ref={refCanvas} className="h-full w-full" />
    </div>
  );
}
