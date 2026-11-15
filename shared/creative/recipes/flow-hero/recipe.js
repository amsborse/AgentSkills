/* Flow hero: a domain-warped noise field in raw WebGL (no library), governed by the quality
 * runtime. Requires ../_runtime/quality.js to be loaded first.
 *
 * ExperienceFlow.mount(element, { quality, speed = 1 }) -> { destroy, refresh, loop }
 *
 * The canvas and GL context exist only while the hero is on screen, the tab is visible and
 * the tier is above static. Otherwise the CSS gradient in recipe.css is what people see.
 * Classic script: defines globalThis.ExperienceFlow. */
(function (global) {
  'use strict';

  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;uniform vec3 c;uniform int o;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    // Octaves follow the tier; dividing by the summed amplitude keeps brightness the same on every tier.
    'float fbm(vec2 p){float v=0.,s=.5;for(int i=0;i<5;i++){if(i>=o)break;v+=s*n(p);p=p*2.02+vec2(17.,9.);s*=.5;}return v/(1.-2.*s);}',
    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*r)/min(r.x,r.y)*1.6;',
    ' vec2 q=vec2(fbm(p+t*.05),fbm(p+vec2(5.2,1.3)-t*.04));',
    ' float f=fbm(p+2.*q+t*.03);',
    ' vec3 col=mix(a,b,smoothstep(.2,.8,f));',
    ' col=mix(col,c,smoothstep(.45,1.,length(q))*.7);',
    ' col+=(h(gl_FragCoord.xy+fract(t))-.5)/170.;', // dither: no banding in slow gradients
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  // Any CSS colour (hex, oklch, color-mix…) to linear 0..1 RGB, by letting the browser paint it.
  function readColor(doc, value, fallback) {
    try {
      var cv = doc.createElement('canvas');
      cv.width = cv.height = 1;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = fallback;
      ctx.fillStyle = (value || '').trim() || fallback; // an invalid value leaves the fallback in place
      ctx.fillRect(0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    } catch (e) {
      return [0.06, 0.13, 0.11];
    }
  }

  function mount(el, opts) {
    opts = opts || {};
    var doc = el.ownerDocument;
    var Q = global.ExperienceQuality;
    if (!Q) throw new Error('flow-hero: load _runtime/quality.js before recipe.js');
    var quality = opts.quality || Q.shared();
    var speed = opts.speed === undefined ? 1 : opts.speed;
    var canvas = null, gl = null, prog = null, buf = null, uni = null, ro = null;
    var needSize = true, needColor = true, shown = false, failed = false, start = null;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
      return s;
    }

    function setup() {
      if (failed) return;
      try {
        canvas = doc.createElement('canvas');
        canvas.className = 'flow-hero__canvas';
        canvas.setAttribute('aria-hidden', 'true');
        gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
        if (!gl) throw new Error('WebGL is not available');
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'program link failed');
        gl.useProgram(prog);
        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the view
        var loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uni = {};
        ['r', 't', 'a', 'b', 'c', 'o'].forEach(function (k) { uni[k] = gl.getUniformLocation(prog, k); });
        canvas.addEventListener('webglcontextlost', onLost);
        el.insertBefore(canvas, el.firstChild);
        if (global.ResizeObserver) { ro = new global.ResizeObserver(function () { needSize = true; }); ro.observe(el); }
        needSize = needColor = true;
        shown = false;
      } catch (e) {
        // No WebGL, or a driver that rejects the shader: the still gradient stays. Say why, once.
        failed = true;
        el.setAttribute('data-flow', 'still');
        if (global.console) global.console.warn('flow-hero: staying on the still gradient: ' + e.message);
        teardown();
        if (loop) loop.stop(); // nothing will ever be drawn: do not keep a frame loop alive for it
      }
    }

    function onLost(e) { e.preventDefault(); failed = true; el.setAttribute('data-flow', 'still'); loop.stop(); }

    function teardown() {
      el.classList.remove('is-live');
      if (ro) { ro.disconnect(); ro = null; }
      if (gl) {
        if (buf) gl.deleteBuffer(buf);
        if (prog) gl.deleteProgram(prog);
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext && !gl.isContextLost()) ext.loseContext(); // hand the GPU memory back now, not at GC
      }
      if (canvas) { canvas.removeEventListener('webglcontextlost', onLost); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); }
      canvas = gl = prog = buf = uni = null;
    }

    function render(t, dt, q) {
      if (!gl) return;
      var budget = q.budget;
      if (needSize) {
        needSize = false;
        var scale = Math.min(global.devicePixelRatio || 1, budget.dpr) * (0.5 + 0.5 * budget.detail);
        var w = Math.max(1, Math.round(el.clientWidth * scale));
        var h = Math.max(1, Math.round(el.clientHeight * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uni.r, w, h);
        gl.uniform1i(uni.o, Math.round(1 + budget.detail * 4));
      }
      if (needColor) {
        needColor = false;
        var cs = global.getComputedStyle(el);
        var A = readColor(doc, cs.getPropertyValue('--flow-a'), '#10201c');
        var B = readColor(doc, cs.getPropertyValue('--flow-b'), '#2b6f5c');
        var C = readColor(doc, cs.getPropertyValue('--flow-c'), '#c98a4b');
        gl.uniform3f(uni.a, A[0], A[1], A[2]);
        gl.uniform3f(uni.b, B[0], B[1], B[2]);
        gl.uniform3f(uni.c, C[0], C[1], C[2]);
      }
      if (start === null) start = t;
      gl.uniform1f(uni.t, ((t - start) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; el.classList.add('is-live'); el.setAttribute('data-flow', 'live'); }
    }

    var loop = quality.loop({
      element: el,
      setup: setup,
      render: render,
      dispose: function () { teardown(); if (!failed) el.setAttribute('data-flow', 'still'); },
      still: function () { el.setAttribute('data-flow', 'still'); }
    });
    if (failed) loop.stop(); // set-up ran, and failed, before the handle existed
    if (!el.hasAttribute('data-flow')) el.setAttribute('data-flow', 'still');

    var offTier = quality.on(function () { needSize = true; }); // resolution and octaves follow the tier
    var scheme = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
    function onScheme() { needColor = true; }
    if (scheme && scheme.addEventListener) scheme.addEventListener('change', onScheme);

    return {
      loop: loop,
      /** Call after changing --flow-a/b/c (for example on a theme toggle). */
      refresh: function () { needColor = true; needSize = true; },
      destroy: function () {
        offTier();
        if (scheme && scheme.removeEventListener) scheme.removeEventListener('change', onScheme);
        loop.stop();
        el.removeAttribute('data-flow');
      }
    };
  }

  global.ExperienceFlow = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : window);
