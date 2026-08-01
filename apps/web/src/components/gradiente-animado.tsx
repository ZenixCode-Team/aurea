'use client';

/**
 * Campo de gradiente animado em WebGL2 — malha de ruído com redemoinho.
 *
 * Componente externo, adaptado para a AUREA. O shader veio inteiro de fora e não foi
 * tocado; o que mudou foi o entorno, por três motivos que valem registro:
 *
 * 1. **Sem reconstrução a cada tecla.** No original, `params` era memorizado sobre a
 *    IDENTIDADE do objeto `config`. Como a página passa `config={{...}}` inline, cada
 *    render criava objeto novo, o `useMemo` recalculava e o efeito derrubava e
 *    remontava o contexto WebGL inteiro. Na tela de entrar isso quer dizer: shader
 *    reiniciando a cada caractere digitado no campo de CPF. Aqui os parâmetros vivem
 *    num ref lido pelo laço de animação, então mudança de prop entra no PRÓXIMO
 *    QUADRO e o contexto nunca é remontado.
 * 2. **`prefers-reduced-motion`.** Quem usa este produto está em quimioterapia, e
 *    náusea com sensibilidade vestibular é efeito colateral comum. A velocidade cai a
 *    um quarto — mesmo fator do `FundoOrganico`, para os dois campos envelhecerem
 *    juntos.
 * 3. **`as any` fora.** `scripts/conformidade.mjs` reprova `any` em qualquer arquivo
 *    de `src/`, e com razão.
 *
 * LEI DO ADR-004 — dentro do produto, o único preset autorizado é `Aurea`. Os outros
 * ficam porque são a peça original e servem a protótipo, mas rosa, ciano e verde neon
 * não entram em tela de paciente: aqui cor tem significado clínico.
 */

import { useRef, useEffect, type CSSProperties } from 'react';
import {
  BarreiraDoGradiente,
  RecuoDoGradiente,
} from '@/components/gradiente-animado-barreira';

type FormaDoPadrao = 'Checks' | 'Stripes' | 'Edge';

const FORMAS: Record<FormaDoPadrao, number> = {
  Checks: 0,
  Stripes: 1,
  Edge: 2,
};

interface ParametrosDoPreset {
  color1: string;
  color2: string;
  color3: string;
  rotation: number;
  proportion: number;
  scale: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  softness: number;
  offset: number;
  shape: FormaDoPadrao;
  shapeSize: number;
}

export type NomeDoPreset =
  | 'Aurea'
  | 'AureaClara'
  | 'Aurora'
  | 'Oceanic'
  | 'Amber'
  | 'Toxic'
  | 'Ghost';

const PRESETS: Record<NomeDoPreset, ParametrosDoPreset> = {
  /**
   * O verde do site é um só. Estas três cores são as mesmas massas do
   * `FundoOrganico` na paleta `verde` (#16221a · #46582f · #7a8b53), então a pessoa
   * que vem da landing reencontra o mesmo campo na porta.
   *
   * `Edge` e não `Checks`: o painel é alto e estreito, e xadrez em quadro vertical
   * vira textura repetida. Borda dá massa contínua, que é o que o texto por cima
   * precisa. Velocidade 8 — deriva lenta não é gatilho vestibular.
   */
  Aurea: {
    color1: '#16221a',
    color2: '#46582f',
    color3: '#7a8b53',
    rotation: -18,
    proportion: 58,
    scale: 0.45,
    speed: 8,
    distortion: 22,
    swirl: 55,
    swirlIterations: 8,
    softness: 100,
    offset: 120,
    shape: 'Edge',
    shapeSize: 45,
  },
  /**
   * A hero é campo CLARO — e isso não é gosto, é estrutura: o texto é branco sem véu
   * por cima, os filetes são brancos, o halo do cursor mescla em `plus-lighter`, e o
   * `data-cor-fundo="#8fa05e"` pinta o corpo da página do mesmo verde claro enquanto
   * a seção está em quadro. Escurecer o campo aqui quebraria as quatro coisas juntas.
   *
   * As três massas são a paleta `verde` do `FundoOrganico`, na mesma ordem de
   * luminância: vale #546638 · base #7a8b53 · crista #cfdaaf. `proportion` 42 mantém
   * a crista clara em minoria, senão o branco do título perde apoio.
   *
   * Calibragem: a primeira tentativa foi `scale 0.55 · shapeSize 55 · swirl 70 ·
   * swirlIterations 10 · distortion 30` — mármore denso, bonito e ERRADO aqui: célula
   * pequena vira detalhe de alta frequência atrás de um título de 5.5rem, e os dois
   * disputam o olho. Estes valores abrem a célula (escala e `shapeSize` MENORES = massa
   * MAIOR, o shader multiplica o uv por eles) e derrubam o redemoinho pela metade. Para
   * voltar ao mármore denso, é só restaurar os cinco números acima.
   */
  AureaClara: {
    color1: '#546638',
    color2: '#7a8b53',
    color3: '#cfdaaf',
    rotation: 0,
    proportion: 42,
    scale: 0.3,
    speed: 8,
    distortion: 18,
    swirl: 42,
    swirlIterations: 6,
    softness: 100,
    offset: 60,
    shape: 'Checks',
    shapeSize: 22,
  },
  Aurora: {
    color1: '#0a001a',
    color2: '#1a0b2e',
    color3: '#f20089',
    rotation: -45,
    proportion: 60,
    scale: 0.6,
    speed: 15,
    distortion: 40,
    swirl: 80,
    swirlIterations: 10,
    softness: 100,
    offset: 200,
    shape: 'Edge',
    shapeSize: 50,
  },
  Oceanic: {
    color1: '#000814',
    color2: '#001d3d',
    color3: '#00b4d8',
    rotation: 0,
    proportion: 70,
    scale: 0.4,
    speed: 10,
    distortion: 15,
    swirl: 50,
    swirlIterations: 12,
    softness: 80,
    offset: 150,
    shape: 'Checks',
    shapeSize: 30,
  },
  Amber: {
    color1: '#140c00',
    color2: '#4a2500',
    color3: '#f57c00',
    rotation: 120,
    proportion: 80,
    scale: 0.8,
    speed: 20,
    distortion: 25,
    swirl: 60,
    swirlIterations: 8,
    softness: 90,
    offset: 500,
    shape: 'Stripes',
    shapeSize: 40,
  },
  Toxic: {
    color1: '#050d05',
    color2: '#0a240a',
    color3: '#39ff14',
    rotation: -90,
    proportion: 55,
    scale: 0.5,
    speed: 25,
    distortion: 60,
    swirl: 100,
    swirlIterations: 15,
    softness: 70,
    offset: -100,
    shape: 'Edge',
    shapeSize: 20,
  },
  Ghost: {
    color1: '#0a0a0a',
    color2: '#1c1c1c',
    color3: '#a3a3a3',
    rotation: 45,
    proportion: 50,
    scale: 0.3,
    speed: 8,
    distortion: 10,
    swirl: 30,
    swirlIterations: 5,
    softness: 100,
    offset: 0,
    shape: 'Checks',
    shapeSize: 60,
  },
};

export interface ConfigSobMedida {
  preset: 'custom';
  color1: string;
  color2: string;
  color3: string;
  rotation?: number;
  proportion?: number;
  scale?: number;
  speed?: number;
  distortion?: number;
  swirl?: number;
  swirlIterations?: number;
  softness?: number;
  offset?: number;
  shape?: FormaDoPadrao;
  shapeSize?: number;
}

export interface ConfigDePreset {
  preset: NomeDoPreset;
  speed?: number;
}

export type ConfigDoGradiente = ConfigSobMedida | ConfigDePreset;

export interface ConfigDeGrao {
  opacity: number;
  scale?: number;
}

export interface PropsDoGradienteAnimado {
  config?: ConfigDoGradiente;
  /** Grão próprio do componente. Na AUREA o grão vem da classe `.grain`, não daqui. */
  grao?: ConfigDeGrao;
  radius?: string;
  style?: CSSProperties;
  className?: string;
}

function resolverParametros(config: ConfigDoGradiente): ParametrosDoPreset {
  if (config.preset === 'custom') {
    return {
      color1: config.color1,
      color2: config.color2,
      color3: config.color3,
      rotation: config.rotation ?? 0,
      proportion: config.proportion ?? 35,
      scale: config.scale ?? 1,
      speed: config.speed ?? 25,
      distortion: config.distortion ?? 12,
      swirl: config.swirl ?? 80,
      swirlIterations: config.swirlIterations ?? 10,
      softness: config.softness ?? 100,
      offset: config.offset ?? 0,
      shape: config.shape ?? 'Checks',
      shapeSize: config.shapeSize ?? 10,
    };
  }
  const preset = PRESETS[config.preset] ?? PRESETS.Aurea;
  return { ...preset, speed: config.speed ?? preset.speed };
}

function juntarClasses(...partes: Array<string | undefined>): string {
  return partes.filter(Boolean).join(' ');
}

export function GradienteAnimado({
  config = { preset: 'Aurea' },
  grao,
  radius = '0px',
  style,
  className,
}: PropsDoGradienteAnimado) {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const refContainer = useRef<HTMLDivElement>(null);
  const refQuadro = useRef<number | undefined>(undefined);
  const refInicio = useRef<number>(0);

  /* Os parâmetros vivem num ref porque o laço de animação os lê a cada quadro. É o
     que impede o contexto WebGL de ser remontado quando a página re-renderiza —
     numa tela com formulário, isso acontece a cada tecla. Escrever ref durante o
     render é proibido, então a atualização mora num efeito sem lista de dependências:
     roda depois de todo render, custa a construção de um objeto pequeno. */
  const refParametros = useRef<ParametrosDoPreset>(resolverParametros(config));

  useEffect(() => {
    refParametros.current = resolverParametros(config);
  });

  useEffect(() => {
    const canvas = refCanvas.current;
    const container = refContainer.current;
    if (!canvas || !container) return;

    /* Sem WebGL, o canvas simplesmente sai da frente e aparece o recuo estático que
       já está pintado atrás dele. É de propósito que isto não seja estado: trocar
       para o recuo por re-render causaria piscada, e o degradê congelado precisa
       estar lá desde o primeiro quadro, não depois da falha. */
    const desistir = () => {
      canvas.style.display = 'none';
    };

    try {
      const gl = canvas.getContext('webgl2', {
        premultipliedAlpha: true,
        alpha: true,
        antialias: true,
      });
      if (!gl) {
        desistir();
        return;
      }

      const vertexShaderSource = `#version 300 es
    in vec4 a_position;
    void main() {
      gl_Position = a_position;
    }`;

      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(vertexShader, vertexShaderSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        gl.deleteShader(vertexShader);
        desistir();
        return;
      }

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        desistir();
        return;
      }

      const program = gl.createProgram()!;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        desistir();
        return;
      }
      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        u_time: gl.getUniformLocation(program, 'u_time'),
        u_resolution: gl.getUniformLocation(program, 'u_resolution'),
        u_pixelRatio: gl.getUniformLocation(program, 'u_pixelRatio'),
        u_scale: gl.getUniformLocation(program, 'u_scale'),
        u_rotation: gl.getUniformLocation(program, 'u_rotation'),
        u_color1: gl.getUniformLocation(program, 'u_color1'),
        u_color2: gl.getUniformLocation(program, 'u_color2'),
        u_color3: gl.getUniformLocation(program, 'u_color3'),
        u_proportion: gl.getUniformLocation(program, 'u_proportion'),
        u_softness: gl.getUniformLocation(program, 'u_softness'),
        u_shape: gl.getUniformLocation(program, 'u_shape'),
        u_shapeScale: gl.getUniformLocation(program, 'u_shapeScale'),
        u_distortion: gl.getUniformLocation(program, 'u_distortion'),
        u_swirl: gl.getUniformLocation(program, 'u_swirl'),
        u_swirlIterations: gl.getUniformLocation(program, 'u_swirlIterations'),
      };

      const redimensionar = () => {
        const largura = container.clientWidth;
        const altura = container.clientHeight;
        const densidade = window.devicePixelRatio || 1;
        canvas.width = largura * densidade;
        canvas.height = altura * densidade;
        canvas.style.width = `${largura}px`;
        canvas.style.height = `${altura}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      redimensionar();
      const observador = new ResizeObserver(redimensionar);
      observador.observe(container);

      /* Paciente em quimioterapia pode ter náusea e sensibilidade vestibular. Mesmo
         fator do `FundoOrganico`: um quarto da velocidade, não parada total — campo
         congelado num quadro qualquer da deriva costuma cair num estado feio. */
      const prefereMenosMovimento = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const fator = prefereMenosMovimento ? 0.25 : 1;

      refInicio.current = performance.now();

      const animar = (agora: number) => {
        const parametros = refParametros.current;
        const decorrido = (agora - refInicio.current) / 1000;
        const velocidade = (parametros.speed / 100) * 5 * fator;

        gl.uniform1f(uniforms.u_time, decorrido * velocidade + parametros.offset * 0.01);
        gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
        gl.uniform1f(uniforms.u_pixelRatio, window.devicePixelRatio || 1);
        gl.uniform1f(uniforms.u_scale, parametros.scale);
        gl.uniform1f(uniforms.u_rotation, (parametros.rotation * Math.PI) / 180);

        const c1 = hexParaRgba(parametros.color1);
        const c2 = hexParaRgba(parametros.color2);
        const c3 = hexParaRgba(parametros.color3);
        gl.uniform4f(uniforms.u_color1, c1[0], c1[1], c1[2], c1[3]);
        gl.uniform4f(uniforms.u_color2, c2[0], c2[1], c2[2], c2[3]);
        gl.uniform4f(uniforms.u_color3, c3[0], c3[1], c3[2], c3[3]);

        gl.uniform1f(uniforms.u_proportion, parametros.proportion / 100);
        gl.uniform1f(uniforms.u_softness, parametros.softness / 100);
        gl.uniform1f(uniforms.u_shape, FORMAS[parametros.shape]);
        gl.uniform1f(uniforms.u_shapeScale, parametros.shapeSize / 100);
        gl.uniform1f(uniforms.u_distortion, parametros.distortion / 50);
        gl.uniform1f(uniforms.u_swirl, parametros.swirl / 100);
        gl.uniform1f(
          uniforms.u_swirlIterations,
          parametros.swirl === 0 ? 0 : parametros.swirlIterations,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        refQuadro.current = requestAnimationFrame(animar);
      };

      refQuadro.current = requestAnimationFrame(animar);

      return () => {
        if (refQuadro.current !== undefined) cancelAnimationFrame(refQuadro.current);
        observador.disconnect();
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteBuffer(positionBuffer);
      };
    } catch {
      desistir();
      return;
    }
  }, []);

  const classes = juntarClasses('absolute inset-0 overflow-hidden', className);

  return (
    <BarreiraDoGradiente recuo={<RecuoDoGradiente className={classes} />}>
      <div
        ref={refContainer}
        className={classes}
        style={{ borderRadius: radius, ...style }}
      >
        {/* Base estática, pintada desde o primeiro quadro. O canvas cobre por cima
            quando o WebGL sobe; quando não sobe, é isto que a pessoa vê. */}
        <RecuoDoGradiente className="absolute inset-0" />
        <canvas
          ref={refCanvas}
          style={{
            display: 'block',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
        {grao && grao.opacity > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAAAAAAAAAAAAAAAAAAAAADgKxmiAAAABnRSTlMCCgkGBAVJOAVJAAAASklEQVQ4y2NgGAWjYBSMglEwCgY/YGRgZBQUYmJiZGQEkYwMjIyMgoKCjIyMIJKBgRFIMjIyAklGRkYGRkFBYEcwMDIyMjAOUQAA1I4HwVwZAkYAAAAASUVORK5CYII=")`,
              backgroundSize: (grao.scale ?? 1) * 200,
              backgroundRepeat: 'repeat',
              opacity: grao.opacity / 2,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </BarreiraDoGradiente>
  );
}

function hexParaRgba(hex: string): [number, number, number, number] {
  let r = 0,
    g = 0,
    b = 0,
    a = 1;

  if (hex.startsWith('rgba(')) {
    const partes = hex.slice(5, -1).split(',');
    r = parseInt(partes[0] ?? '0') / 255;
    g = parseInt(partes[1] ?? '0') / 255;
    b = parseInt(partes[2] ?? '0') / 255;
    a = parseFloat(partes[3] ?? '1');
  } else if (hex.startsWith('rgb(')) {
    const partes = hex.slice(4, -1).split(',');
    r = parseInt(partes[0] ?? '0') / 255;
    g = parseInt(partes[1] ?? '0') / 255;
    b = parseInt(partes[2] ?? '0') / 255;
  } else if (hex.startsWith('hsla(') || hex.startsWith('hsl(')) {
    const temAlfa = hex.startsWith('hsla(');
    const partes = hex.slice(temAlfa ? 5 : 4, -1).split(',');
    const h = parseFloat(partes[0] ?? '0') / 360;
    const s = parseFloat(partes[1] ?? '0') / 100;
    const l = parseFloat(partes[2] ?? '0') / 100;
    a = temAlfa ? parseFloat(partes[3] ?? '1') : 1;
    [r, g, b] = hslParaRgb(h, s, l);
  } else if (hex.startsWith('#')) {
    const c = hex.slice(1);
    if (c.length === 3) {
      r = parseInt(c.charAt(0) + c.charAt(0), 16) / 255;
      g = parseInt(c.charAt(1) + c.charAt(1), 16) / 255;
      b = parseInt(c.charAt(2) + c.charAt(2), 16) / 255;
    } else if (c.length >= 6) {
      r = parseInt(c.slice(0, 2), 16) / 255;
      g = parseInt(c.slice(2, 4), 16) / 255;
      b = parseInt(c.slice(4, 6), 16) / 255;
      if (c.length === 8) a = parseInt(c.slice(6, 8), 16) / 255;
    }
  }

  return [r, g, b, a];
}

function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const matizParaCanal = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = matizParaCanal(p, q, h + 1 / 3);
    g = matizParaCanal(p, q, h);
    b = matizParaCanal(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);
    float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    float t = .5 * u_time;

    float noise_scale = .0005 + .006 * u_scale;

    uv -= .5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * .5 * PI);
    uv /= u_pixelRatio;
    uv += .5;

    float n1 = noise(uv * 1. + t);
    float n2 = noise(uv * 2. - t);
    float angle = n1 * TWO_PI;
    uv.x += 4. * u_distortion * n2 * cos(angle);
    uv.y += 4. * u_distortion * n2 * sin(angle);

    float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));
    for (float i = 1.; i <= iterations_number; i++) {
        uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);
        uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);
    }

    float proportion = clamp(u_proportion, 0., 1.);

    float shape = 0.;
    float mixer = 0.;
    if (u_shape < .5) {
      vec2 checks_shape_uv = uv * (.5 + 3.5 * u_shapeScale);
      shape = .5 + .5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (.25 + 3. * u_shapeScale);
      float f = fract(stripes_shape_uv.y);
      shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);
      mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);
    } else {
      float sh = 1. - uv.y;
      sh -= .5;
      sh /= (noise_scale * u_resolution.y);
      sh += .5;
      float shape_scaling = .2 * (1. - u_shapeScale);
      shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale);

    fragColor = vec4(color_mix.rgb, color_mix.a);
}
`;

export default GradienteAnimado;
