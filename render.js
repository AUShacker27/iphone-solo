const MAX_STRETCH = 1.7;

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_position * 0.5 + 0.5;
}`;

const FOLD = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_imageSize;
uniform vec2 u_cover;
uniform float u_aspect;
uniform float u_turn;
uniform float u_hinge;
in vec2 v_uv;
out vec4 outColor;

const float HALF_PI = 1.570796327;
const float BLUR = 0.0315;
const float MAX_TILT = ${Math.acos(1 / MAX_STRETCH).toFixed(6)};
const vec3 DARK = vec3(0.003, 0.004, 0.005);

vec3 sampleImage(vec2 uv, float sigma) {
  vec2 tuv = (uv - 0.5) * u_cover + 0.5;
  float lod = max(0.0, log2(max(sigma, 1.0)));
  vec3 blurred = textureLod(u_image, tuv, max(1.0, lod)).rgb;
  if (sigma >= 2.0) return blurred;
  return mix(textureLod(u_image, tuv, 0.0).rgb, blurred, smoothstep(0.0, 2.0, sigma));
}

void main() {
  float turn = clamp(u_turn, 0.0, 1.0);
  if (turn <= 0.00001) {
    outColor = vec4(sampleImage(v_uv, 0.0), 1.0);
    return;
  }

  // Hinge projection
  float outer = 1.0 - u_hinge;
  float fromHinge = abs(v_uv.x - u_hinge);
  float tilt = turn * HALF_PI;
  float bend = min(tilt, MAX_TILT);
  float cosine = cos(bend);
  float sine = sin(bend);

  float eye = 2.4 * max(u_aspect, 1.0);
  float depth = fromHinge * u_aspect * sine;
  float perspective = eye / (eye - depth);
  vec2 plane;
  plane.x = u_hinge + (v_uv.x - u_hinge) * cosine * perspective;
  plane.y = 0.5 + (v_uv.y - 0.5) * perspective;

  // Defocus
  float blurAngle = pow(smoothstep(0.0, HALF_PI, tilt), 0.5);
  float blurSpread = pow(smoothstep(0.0, 0.7, fromHinge), 1.45);
  float defocus = blurAngle * mix(0.18, 1.0, blurSpread);
  float sigma = u_imageSize.x * BLUR * defocus;

  // Vertical margins
  float softness = fwidth(v_uv.y) + 2.0 * sigma / u_imageSize.y;
  float mask = 1.0 - smoothstep(0.5 - softness, 0.5 + softness, abs(plane.y - 0.5));

  // Glass
  vec3 color = sampleImage(plane, sigma);
  float glass = sine * pow(fromHinge, 1.6);
  color *= 1.0 - mix(0.28, 0.06, outer) * glass;
  float reflection = exp(-pow((fromHinge - 0.70) / 0.30, 2.0)) * sine;
  color += vec3(0.82, 0.85, 0.86) * reflection * 0.025;

  // Void
  float fade = clamp((fromHinge - 0.26) / 0.74, 0.0, 1.0);
  color *= 1.0 - 0.7 * blurAngle * fade;

  outColor = vec4(mix(DARK, color, mask), 1.0);
}`;

const GAUSS = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform vec2 u_step;
uniform float u_level;
in vec2 v_uv;
out vec4 outColor;

void main() {
  vec4 color = textureLod(u_source, v_uv, u_level) * 0.2270270270;
  color += textureLod(u_source, v_uv + u_step * 1.3846153846, u_level) * 0.3162162162;
  color += textureLod(u_source, v_uv - u_step * 1.3846153846, u_level) * 0.3162162162;
  color += textureLod(u_source, v_uv + u_step * 3.2307692308, u_level) * 0.0702702703;
  color += textureLod(u_source, v_uv - u_step * 3.2307692308, u_level) * 0.0702702703;
  outColor = color;
}`;

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  // Programs
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function link(fragment) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function uniforms(program, names) {
    return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
  }

  const fold = link(FOLD);
  const foldU = uniforms(fold, ['u_image', 'u_imageSize', 'u_cover', 'u_aspect', 'u_turn', 'u_hinge']);
  const gauss = link(GAUSS);
  const gaussU = uniforms(gauss, ['u_source', 'u_step', 'u_level']);

  // Quad
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Texture
  const texture = gl.createTexture();
  let imageSize = [1, 1];

  function clampToEdge() {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  clampToEdge();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  // Gaussian mips
  function blurMips(width, height) {
    gl.generateMipmap(gl.TEXTURE_2D);

    const scratch = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, scratch);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    clampToEdge();
    gl.useProgram(gauss);
    gl.uniform1i(gaussU.u_source, 0);

    const levels = Math.floor(Math.log2(Math.max(width, height)));
    for (let level = 1; level <= levels; level++) {
      const w = Math.max(1, width >> level);
      const h = Math.max(1, height >> level);
      const sourceW = Math.max(1, width >> (level - 1));
      const sourceH = Math.max(1, height >> (level - 1));

      gl.bindTexture(gl.TEXTURE_2D, scratch);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scratch, 0);
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1f(gaussU.u_level, level - 1);
      gl.uniform2f(gaussU.u_step, 1 / sourceW, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, level);
      gl.bindTexture(gl.TEXTURE_2D, scratch);
      gl.uniform1f(gaussU.u_level, 0);
      gl.uniform2f(gaussU.u_step, 0, 1 / sourceH);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(scratch);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function upload(image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    imageSize = [image.naturalWidth || image.width, image.naturalHeight || image.height];
    blurMips(imageSize[0], imageSize[1]);
  }

  function load(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        upload(image);
        resolve();
      };
      image.onerror = reject;
      image.src = source;
    });
  }

  // Frame
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  function draw(turn, hinge) {
    resize();

    const aspect = canvas.width / canvas.height;
    const imageAspect = imageSize[0] / imageSize[1];

    gl.useProgram(fold);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(foldU.u_image, 0);
    gl.uniform2f(foldU.u_imageSize, imageSize[0], imageSize[1]);
    gl.uniform2f(foldU.u_cover, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
    gl.uniform1f(foldU.u_aspect, aspect);
    gl.uniform1f(foldU.u_turn, turn);
    gl.uniform1f(foldU.u_hinge, hinge);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  return { load, draw };
}
