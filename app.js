(function(){
  const sceneEl = document.getElementById('scene');
  const status = document.createElement('div');
  status.style.position = 'fixed';
  status.style.top = '10px';
  status.style.right = '10px';
  status.style.background = 'rgba(0,0,0,0.6)';
  status.style.padding = '6px 8px';
  status.style.borderRadius = '8px';
  status.style.fontSize = '12px';
  status.style.color = '#fff';
  status.textContent = 'Initializing…';
  document.body.appendChild(status);

  function webglAvailable() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  if (!window.THREE) {
    status.textContent = 'Three.js not found. Using WebGL fallback…';
    console.warn('Three.js not found on window. Falling back to raw WebGL.');

    // Raw WebGL fallback: axes + grid + cube
    const canvas = document.createElement('canvas');
    sceneEl.appendChild(canvas);
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      status.textContent = 'WebGL context failed. Please try another browser.';
      return;
    }

    function resizeGL() {
      const rect = sceneEl.getBoundingClientRect();
      const w = Math.max(1, rect.width || window.innerWidth);
      const h = Math.max(1, rect.height || window.innerHeight);
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      aspect = w / h;
    }

    const vsrc = `
      attribute vec3 aPos;
      attribute vec3 aColor;
      uniform mat4 uProj;
      uniform mat4 uView;
      uniform mat4 uModel;
      varying vec3 vColor;
      void main(){
        vColor = aColor;
        gl_Position = uProj * uView * uModel * vec4(aPos,1.0);
      }
    `;
    const fsrc = `
      precision mediump float;
      varying vec3 vColor;
      void main(){ gl_FragColor = vec4(vColor,1.0); }
    `;
    function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ throw new Error(gl.getShaderInfoLog(s)); } return s; }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aColor = gl.getAttribLocation(prog, 'aColor');
    const uProj = gl.getUniformLocation(prog, 'uProj');
    const uView = gl.getUniformLocation(prog, 'uView');
    const uModel = gl.getUniformLocation(prog, 'uModel');

    function mat4Perspective(out, fovy, aspect, near, far){
      const f = 1.0/Math.tan(fovy/2), nf = 1/(near - far);
      out[0]=f/aspect; out[1]=0; out[2]=0; out[3]=0;
      out[4]=0; out[5]=f; out[6]=0; out[7]=0;
      out[8]=0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
      out[12]=0; out[13]=0; out[14]=(2*far*near)*nf; out[15]=0;
      return out;
    }
    function mat4Identity(out){ for(let i=0;i<16;i++) out[i]=(i%5===0)?1:0; return out; }
    function mat4Translate(out, x,y,z){ mat4Identity(out); out[12]=x; out[13]=y; out[14]=z; return out; }
    function mat4RotateY(out, a){ const c=Math.cos(a), s=Math.sin(a); mat4Identity(out); out[0]=c; out[2]=s; out[8]=-s; out[10]=c; return out; }
    function mat4LookAt(out, eye, center, up){
      const ex=eye[0],ey=eye[1],ez=eye[2], cx=center[0],cy=center[1],cz=center[2], ux=up[0],uy=up[1],uz=up[2];
      let zx=ex-cx, zy=ey-cy, zz=ez-cz; let len=Math.hypot(zx,zy,zz); zx/=len; zy/=len; zz/=len;
      let xx=uy*zz-uz*zy, xy=uz*zx-ux*zz, xz=ux*zy-uy*zx; len=Math.hypot(xx,xy,xz); xx/=len; xy/=len; xz/=len;
      let yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      out[0]=xx; out[1]=yx; out[2]=zx; out[3]=0;
      out[4]=xy; out[5]=yy; out[6]=zy; out[7]=0;
      out[8]=xz; out[9]=yz; out[10]=zz; out[11]=0;
      out[12]=-(xx*ex+xy*ey+xz*ez);
      out[13]=-(yx*ex+yy*ey+yz*ez);
      out[14]=-(zx*ex+zy*ey+zz*ez);
      out[15]=1; return out;
    }

    // Build axes (RGB) and grid (blueish)
    const lines = [];
    function pushLine(x1,y1,z1,x2,y2,z2, r,g,b){ lines.push(x1,y1,z1,r,g,b,x2,y2,z2,r,g,b); }
    // Axes
    pushLine(0,0,0, 5,0,0, 1,0,0);
    pushLine(0,0,0, 0,5,0, 0,1,0);
    pushLine(0,0,0, 0,0,5, 0,0,1);
    // Grid on XZ
    const N=20, S=20;
    for(let i=-N;i<=N;i++){
      const c=0.2; pushLine(-S,0,i, S,0,i, 0.2,0.4,0.8);
      pushLine(i,0,-S, i,0,S, 0.2,0.4,0.8);
    }
    let lineData = new Float32Array(lines);
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.STATIC_DRAW);
    const stride = 6*4; // pos(3) + color(3)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0); gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 3*4); gl.enableVertexAttribArray(aColor);

    // Simple cube (lines)
    const C=0.5;
    const cubeLines = [
      [-C,-C,-C, C,-C,-C], [-C,-C,-C, -C,C,-C], [-C,-C,-C, -C,-C,C],
      [ C, C, C, -C, C, C], [ C, C, C, C,-C, C], [ C, C, C, C, C,-C],
      [ C,-C,-C, C,-C, C], [ -C, C,-C, -C, C, C], [ -C,-C, C, C,-C, C],
      [ -C, C,-C, C, C,-C], [ C,-C,-C, C, C,-C], [ -C,-C, C, -C, C, C]
    ];
    const cubeArr = [];
    cubeLines.forEach(([x1,y1,z1,x2,y2,z2])=>{ cubeArr.push(x1,y1,z1,1,0.7,0.3, x2,y2,z2,1,0.7,0.3); });
    let cubeData = new Float32Array(cubeArr);
    const cubeVbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo); gl.bufferData(gl.ARRAY_BUFFER, cubeData, gl.STATIC_DRAW);

    // Fallback dynamic entities
    let fallbackPlanes = []; // each: {vbo, count, origin, normal}
    let fallbackPoints = []; // each: {vbo, count}

    // UI wiring for fallback
    const $ = (id) => document.getElementById(id);
    const posLabel = $('posLabel');
    function currentUVFallback() {
      const su = $('su'); const sv = $('sv');
      const u = parseFloat(su?.value ?? '0');
      const v = parseFloat(sv?.value ?? '0');
      if (posLabel) posLabel.textContent = `u=${u}, v=${v}`;
      return { u, v };
    }
    ['su','sv'].forEach(id => { const el=$(id); if(el) el.addEventListener('input', currentUVFallback); });
    currentUVFallback();

    function addFallbackPlaneFromNormalPoint(point, normal, size, colorRGB) {
      const n = normalize(normal);
      const arb = Math.abs(n.x) < 0.9 ? {x:1,y:0,z:0} : {x:0,y:1,z:0};
      const u = normalize(cross(n, arb));
      const v = normalize(cross(n, u));
      const s2 = size/2;
      const corners = [
        add(point, add(scale(u, -s2), scale(v, -s2))),
        add(point, add(scale(u,  s2), scale(v, -s2))),
        add(point, add(scale(u,  s2), scale(v,  s2))),
        add(point, add(scale(u, -s2), scale(v,  s2)))
      ];
      const arr = [];
      function pushEdge(a,b){ arr.push(a.x,a.y,a.z,colorRGB.r,colorRGB.g,colorRGB.b, b.x,b.y,b.z,colorRGB.r,colorRGB.g,colorRGB.b); }
      pushEdge(corners[0], corners[1]);
      pushEdge(corners[1], corners[2]);
      pushEdge(corners[2], corners[3]);
      pushEdge(corners[3], corners[0]);
      const data = new Float32Array(arr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      fallbackPlanes.push({ vbo: buf, count: data.length/6, origin: point, normal: n, U: u, V: v });
      // update dropdown
      const planeSelect = document.getElementById('planeSelect');
        if (planeSelect) {
          const opt = document.createElement('option');
          opt.value = String(fallbackPlanes.length - 1);
          opt.textContent = `Plane ${fallbackPlanes.length}`;
          planeSelect.appendChild(opt);
        }
    }

    function addFallbackPoint(pos, size, colorRGB) {
      const s2 = size*2;
      const arr = new Float32Array([
        pos.x-s2, pos.y, pos.z, colorRGB.r,colorRGB.g,colorRGB.b, pos.x+s2, pos.y, pos.z, colorRGB.r,colorRGB.g,colorRGB.b,
        pos.x, pos.y-s2, pos.z, colorRGB.r,colorRGB.g,colorRGB.b, pos.x, pos.y+s2, pos.z, colorRGB.r,colorRGB.g,colorRGB.b,
        pos.x, pos.y, pos.z-s2, colorRGB.r,colorRGB.g,colorRGB.b, pos.x, pos.y, pos.z+s2, colorRGB.r,colorRGB.g,colorRGB.b
      ]);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      fallbackPoints.push({ vbo: buf, count: arr.length/6 });
    }

    function hexToRgb(hex){
      const n = parseInt((hex||'#a66df2').replace('#',''),16);
      return { r: ((n>>16)&255)/255, g: ((n>>8)&255)/255, b: (n&255)/255 };
    }
    function normalize(a){ const l=Math.hypot(a.x,a.y,a.z)||1; return { x:a.x/l, y:a.y/l, z:a.z/l }; }
    function cross(a,b){ return { x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x }; }
    function add(a,b){ return { x:a.x+b.x, y:a.y+b.y, z:a.z+b.z }; }
    function scale(a,s){ return { x:a.x*s, y:a.y*s, z:a.z*s }; }

    if ($('addPlane')) {
      $('addPlane').onclick = () => {
        const size = parseFloat($('planeSize').value);
        const color = hexToRgb($('planeColor').value);
        const mode = $('planeMode').value;
        if (mode === 'normalPoint') {
          const q = { x:parseFloat($('qpx').value), y:parseFloat($('qpy').value), z:parseFloat($('qpz').value) };
          const n = { x:parseFloat($('nx').value), y:parseFloat($('ny').value), z:parseFloat($('nz').value) };
          if (Math.hypot(n.x,n.y,n.z) === 0) { alert('Normal cannot be zero vector.'); return; }
          addFallbackPlaneFromNormalPoint(q, n, size, color);
        } else {
          // 3-point plane: approximate by computing normal from points, center at p1
          const p1 = { x:parseFloat($('p1x').value), y:parseFloat($('p1y').value), z:parseFloat($('p1z').value) };
          const p2 = { x:parseFloat($('p2x').value), y:parseFloat($('p2y').value), z:parseFloat($('p2z').value) };
          const p3 = { x:parseFloat($('p3x').value), y:parseFloat($('p3y').value), z:parseFloat($('p3z').value) };
          const u = { x:p2.x-p1.x, y:p2.y-p1.y, z:p2.z-p1.z };
          const v = { x:p3.x-p1.x, y:p3.y-p1.y, z:p3.z-p1.z };
          const n = cross(u,v);
          addFallbackPlaneFromNormalPoint(p1, n, size, color);
        }
      };
    }

    if ($('clearPlanes')) {
      $('clearPlanes').onclick = () => {
        fallbackPlanes.forEach(p => gl.deleteBuffer(p.vbo)); fallbackPlanes = [];
        const planeSelect = document.getElementById('planeSelect');
        if (planeSelect) { planeSelect.innerHTML = ''; const optNone=document.createElement('option'); optNone.value='-1'; optNone.textContent='None'; planeSelect.appendChild(optNone); }
      };
    }

    if ($('plotPoint')) {
      $('plotPoint').onclick = () => {
        const sel = document.getElementById('planeSelect');
        const size = parseFloat($('pointSize').value);
        const color = hexToRgb($('pointColor').value);
        if (!sel) { alert('Select a plane first.'); return; }
        const idx = parseInt(sel.value, 10);
        if (isNaN(idx) || idx < 0 || idx >= fallbackPlanes.length) { alert('Select a plane first.'); return; }
        const { u, v } = currentUVFallback();
        const plane = fallbackPlanes[idx];
        const p = add(plane.origin, add(scale(plane.U, u), scale(plane.V, v)));
        addFallbackPoint(p, size, color);
      };
    }

    if ($('clearPoints')) {
      $('clearPoints').onclick = () => { fallbackPoints.forEach(p => gl.deleteBuffer(p.vbo)); fallbackPoints = []; };
    }

    let aspect = 1;
    // Simple orbit camera controls (mouse drag)
    let yaw = -0.6, pitch = 0.4, radius = 14;
    let isDragging = false, lastX = 0, lastY = 0;
    sceneEl.addEventListener('mousedown', (e)=>{ isDragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', ()=>{ isDragging = false; });
    window.addEventListener('mousemove', (e)=>{
      if(!isDragging) return;
      const dx = e.clientX - lastX; const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw += dx * 0.005; pitch += dy * 0.005;
      const maxPitch = Math.PI/2 - 0.05;
      if (pitch > maxPitch) pitch = maxPitch;
      if (pitch < -maxPitch) pitch = -maxPitch;
    });
    resizeGL();
    window.addEventListener('resize', resizeGL);
    status.textContent = 'Rendering…';

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.06,0.07,0.12,1);

    const proj = new Float32Array(16);
    const view = new Float32Array(16);
    const model = new Float32Array(16);

    // Fallback live preview crosshair at selected u/v on plane
    const previewBuf = gl.createBuffer();
    function drawFallbackPreview() {
      const sel = document.getElementById('planeSelect');
      const { u, v } = currentUVFallback();
      let arr = null;
      if (sel) {
        const idx = parseInt(sel.value, 10);
        if (!isNaN(idx) && idx >=0 && idx < fallbackPlanes.length) {
          const plane = fallbackPlanes[idx];
          const p = add(plane.origin, add(scale(plane.U, u), scale(plane.V, v)));
          const size = Math.max(0.1, parseFloat(document.getElementById('pointSize')?.value || '0.2'));
          const col = hexToRgb(document.getElementById('pointColor')?.value || '#a66df2');
          const s2 = size*2;
          arr = new Float32Array([
            p.x-s2, p.y, p.z, col.r,col.g,col.b, p.x+s2, p.y, p.z, col.r,col.g,col.b,
            p.x, p.y-s2, p.z, col.r,col.g,col.b, p.x, p.y+s2, p.z, col.r,col.g,col.b,
            p.x, p.y, p.z-s2, col.r,col.g,col.b, p.x, p.y, p.z+s2, col.r,col.g,col.b
          ]);
        }
      }
      if (arr) {
        gl.bindBuffer(gl.ARRAY_BUFFER, previewBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aColor);
        gl.drawArrays(gl.LINES, 0, arr.length/6);
      }
    }

    function render(t){
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      mat4Perspective(proj, Math.PI/3, aspect, 0.1, 100.0);
      const ex = radius * Math.cos(pitch) * Math.cos(yaw);
      const ey = radius * Math.sin(pitch);
      const ez = radius * Math.cos(pitch) * Math.sin(yaw);
      mat4LookAt(view, [ex,ey,ez], [0,0,0], [0,1,0]);

      // Draw grid/axes
      mat4Identity(model);
      gl.uniformMatrix4fv(uProj, false, proj);
      gl.uniformMatrix4fv(uView, false, view);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aColor);
      gl.drawArrays(gl.LINES, 0, lineData.length/6);

      // Draw fallback planes
      fallbackPlanes.forEach(p => {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aColor);
        gl.drawArrays(gl.LINES, 0, p.count);
      });

      // Draw fallback points (crosshairs)
      fallbackPoints.forEach(p => {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.vbo);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(aPos);
        gl.enableVertexAttribArray(aColor);
        gl.drawArrays(gl.LINES, 0, p.count);
      });

        // Live preview at selected plane u/v
        drawFallbackPreview();
      // Draw cube (rotate slowly)
      const angle = (t||0) * 0.0005;
      mat4RotateY(model, angle);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aPos);
      gl.enableVertexAttribArray(aColor);
      gl.drawArrays(gl.LINES, 0, cubeData.length/6);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    return;
  }

  if (!webglAvailable()) {
    status.textContent = 'WebGL not available. Enable hardware acceleration or try another browser.';
    console.error('WebGL not available.');
    return;
  }

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x10131f);
  sceneEl.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(8, 8, 12);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  function resize() {
    const rect = sceneEl.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth);
    const h = Math.max(1, rect.height || window.innerHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const grid = new THREE.GridHelper(40, 40, 0x3355aa, 0x223366);
  scene.add(grid);
  const axes = new THREE.AxesHelper(5);
  scene.add(axes);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1,1,1),
    new THREE.MeshBasicMaterial({ color: 0xff8844 })
  );
  scene.add(cube);
  const planes = []; // {group, origin:THREE.Vector3, normal:THREE.Vector3, U:THREE.Vector3, V:THREE.Vector3}
  const points = []; // THREE.Group for sphere+crosshair
  let previewPointGroup = null; // live-updating projected point (sphere + crosshair)

  window.addEventListener('resize', resize);
  requestAnimationFrame(function(){ resize(); status.textContent = 'Rendering…'; });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // UI wiring (works for both Three.js and fallback branches if elements exist)
  const $ = (id) => document.getElementById(id);
  const posLabel = $('posLabel');
  const planeSelect = $('planeSelect');
  function currentUV() {
    const su = document.getElementById('su');
    const sv = document.getElementById('sv');
    const u = parseFloat(su ? su.value : '0');
    const v = parseFloat(sv ? sv.value : '0');
    if (posLabel) posLabel.textContent = `u=${u}, v=${v}`;
    return { u, v };
  }
  ['su','sv'].forEach(id => { const el=$(id); if(el) el.addEventListener('input', currentUV); });
  currentUV();

  function ensurePreviewPoint() {
    if (previewPointGroup) return previewPointGroup;
    const size = Math.max(0.1, parseFloat(document.getElementById('pointSize')?.value || '0.2'));
    const colorStr = document.getElementById('pointColor')?.value || '#66d9ff';
    const color = parseInt(colorStr.replace('#',''), 16);
    const geom = new THREE.SphereGeometry(size, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geom, mat);
    const crossGeom = new THREE.BufferGeometry();
    const s2 = size*2;
    const verts = new Float32Array([
      -s2,0,0, s2,0,0,
      0,-s2,0, 0,s2,0,
      0,0,-s2, 0,0,s2
    ]);
    crossGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const cross = new THREE.LineSegments(crossGeom, new THREE.LineBasicMaterial({ color }));
    previewPointGroup = new THREE.Group();
    previewPointGroup.add(sphere);
    previewPointGroup.add(cross);
    scene.add(previewPointGroup);
    return previewPointGroup;
  }

  function updatePreviewPoint() {
    // Update preview size/color to match current settings
    if (previewPointGroup) {
      const size = Math.max(0.1, parseFloat(document.getElementById('pointSize')?.value || '0.2'));
      const colorStr = document.getElementById('pointColor')?.value || '#66d9ff';
      const color = parseInt(colorStr.replace('#',''), 16);
      const sphere = previewPointGroup.children.find(c => c.isMesh);
      const cross = previewPointGroup.children.find(c => c.isLineSegments);
      if (sphere) {
        sphere.geometry.dispose();
        sphere.geometry = new THREE.SphereGeometry(size, 12, 12);
        sphere.material.color.set(color);
      }
      if (cross) {
        const s2 = size*2;
        const verts = new Float32Array([
          -s2,0,0, s2,0,0,
          0,-s2,0, 0,s2,0,
          0,0,-s2, 0,0,s2
        ]);
        cross.geometry.dispose();
        cross.geometry = new THREE.BufferGeometry();
        cross.geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        cross.material.color.set(color);
      }
    }
    const idx = parseInt(planeSelect?.value ?? '-1', 10);
    if (isNaN(idx) || idx < 0 || idx >= planes.length) { if (previewPointGroup) previewPointGroup.visible = false; return; }
    const { u, v } = currentUV();
    const plane = planes[idx];
    const proj = plane.origin.clone().add(plane.U.clone().multiplyScalar(u)).add(plane.V.clone().multiplyScalar(v));
    const g = ensurePreviewPoint();
    g.position.set(proj.x, proj.y, proj.z);
    g.visible = true;
  }
  ['su','sv'].forEach(id => { const el=$(id); if(el) el.addEventListener('input', updatePreviewPoint); });
  if (planeSelect) planeSelect.addEventListener('change', updatePreviewPoint);
  const pointSizeEl = document.getElementById('pointSize');
  const pointColorEl = document.getElementById('pointColor');
  if (pointSizeEl) pointSizeEl.addEventListener('input', updatePreviewPoint);
  if (pointColorEl) pointColorEl.addEventListener('input', updatePreviewPoint);
  updatePreviewPoint();

  if ($('planeMode')) {
    $('planeMode').onchange = (e) => {
      const mode = e.target.value;
      $('threePoints').style.display = mode === 'threePoints' ? 'grid' : 'none';
      $('normalPoint').style.display = mode === 'normalPoint' ? 'grid' : 'none';
    };
  }

  function addPlaneMeshFromBasis(origin, u, v, size, color, opacity, wireframe) {
    const planeSize = size;
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
    const w = new THREE.Vector3().crossVectors(new THREE.Vector3(u.x,u.y,u.z), new THREE.Vector3(v.x,v.y,v.z)).normalize();
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(u.x,u.y,u.z).clone().normalize(),
      new THREE.Vector3(v.x,v.y,v.z).clone().normalize(),
      w
    );
    geometry.applyMatrix4(basis);
    geometry.translate(origin.x, origin.y, origin.z);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, wireframe });
    const mesh = new THREE.Mesh(geometry, material);
    const edges = new THREE.EdgesGeometry(geometry);
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
    const group = new THREE.Group(); group.add(mesh); group.add(outline); scene.add(group);
    return group;
  }

  function addPlaneFromThreePoints(p1, p2, p3, size, color, opacity, wireframe) {
    const u = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    const group = addPlaneMeshFromBasis(p1, u, v, size, color, opacity, wireframe);
    const U = new THREE.Vector3(u.x,u.y,u.z).clone().normalize();
    const V = new THREE.Vector3(v.x,v.y,v.z).clone().normalize();
    const normal = new THREE.Vector3().crossVectors(U, V).normalize();
    planes.push({ group, origin: new THREE.Vector3(p1.x,p1.y,p1.z), normal, U, V });
    if (planeSelect) {
      const opt = document.createElement('option');
      opt.value = String(planes.length - 1);
      opt.textContent = `Plane ${planes.length}`;
      planeSelect.appendChild(opt);
    }
    return group;
  }

  function addPlaneFromNormalPoint(point, normal, size, color, opacity, wireframe) {
    const n = new THREE.Vector3(normal.x,normal.y,normal.z).normalize();
    let arbitrary = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
    const u = new THREE.Vector3().crossVectors(n, arbitrary).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    const group = addPlaneMeshFromBasis(point, {x:u.x,y:u.y,z:u.z}, {x:v.x,y:v.y,z:v.z}, size, color, opacity, wireframe);
    planes.push({ group, origin: new THREE.Vector3(point.x,point.y,point.z), normal: n.clone(), U: u.clone(), V: v.clone() });
    if (planeSelect) {
      const opt = document.createElement('option');
      opt.value = String(planes.length - 1);
      opt.textContent = `Plane ${planes.length}`;
      planeSelect.appendChild(opt);
    }
    return group;
  }

  if ($('addPlane')) {
    $('addPlane').onclick = () => {
      const size = parseFloat($('planeSize').value);
      const opacity = parseFloat($('planeOpacity').value);
      const colorStr = $('planeColor').value || '#56ccf2';
      const color = parseInt(colorStr.replace('#',''), 16);
      const wire = $('planeWire').value === '1';
      const mode = $('planeMode').value;
      let group;
      if (mode === 'threePoints') {
        const p1 = { x:parseFloat($('p1x').value), y:parseFloat($('p1y').value), z:parseFloat($('p1z').value) };
        const p2 = { x:parseFloat($('p2x').value), y:parseFloat($('p2y').value), z:parseFloat($('p2z').value) };
        const p3 = { x:parseFloat($('p3x').value), y:parseFloat($('p3y').value), z:parseFloat($('p3z').value) };
        group = addPlaneFromThreePoints(p1, p2, p3, size, color, opacity, wire);
      } else {
        const q = { x:parseFloat($('qpx').value), y:parseFloat($('qpy').value), z:parseFloat($('qpz').value) };
        const n = { x:parseFloat($('nx').value), y:parseFloat($('ny').value), z:parseFloat($('nz').value) };
        if (Math.hypot(n.x,n.y,n.z) === 0) { alert('Normal cannot be zero vector.'); return; }
        group = addPlaneFromNormalPoint(q, n, size, color, opacity, wire);
      }
    };
  }

  if ($('clearPlanes')) {
    $('clearPlanes').onclick = () => {
      planes.forEach(p => scene.remove(p.group));
      planes.length = 0;
      if (planeSelect) {
        planeSelect.innerHTML = '';
        const optNone = document.createElement('option');
        optNone.value = '-1'; optNone.textContent = 'None';
        planeSelect.appendChild(optNone);
      }
    };
  }

  function uvPointOnSelectedPlane() {
    const idx = parseInt(planeSelect?.value ?? '-1', 10);
    if (isNaN(idx) || idx < 0 || idx >= planes.length) return null;
    const { u, v } = currentUV();
    const plane = planes[idx];
    const projected = plane.origin.clone().add(plane.U.clone().multiplyScalar(u)).add(plane.V.clone().multiplyScalar(v));
    return { x: projected.x, y: projected.y, z: projected.z };
  }

  if ($('plotPoint')) {
    $('plotPoint').onclick = () => {
      const proj = uvPointOnSelectedPlane();
      if (!proj) { alert('Select a plane before plotting a point.'); return; }
      const size = parseFloat($('pointSize').value);
      const colorStr = $('pointColor').value || '#a66df2';
      const color = parseInt(colorStr.replace('#',''), 16);
      const geom = new THREE.SphereGeometry(size, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(geom, mat);
      sphere.position.set(proj.x, proj.y, proj.z);
      const crossGeom = new THREE.BufferGeometry();
      const s2 = size*2;
      const verts = new Float32Array([
        -s2,0,0, s2,0,0,
        0,-s2,0, 0,s2,0,
        0,0,-s2, 0,0,s2
      ]);
      crossGeom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const cross = new THREE.LineSegments(crossGeom, new THREE.LineBasicMaterial({ color }));
      cross.position.set(proj.x, proj.y, proj.z);
      const group = new THREE.Group(); group.add(sphere); group.add(cross); scene.add(group);
      points.push(group);
      updatePreviewPoint();
    };
  }

  if ($('clearPoints')) {
    $('clearPoints').onclick = () => { points.forEach(g => scene.remove(g)); points.length = 0; };
  }
})();
