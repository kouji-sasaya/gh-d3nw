// 球体を立体的にし、左上から光が当たるように表現
// status=errorは赤で点滅、status=warningは黄で点滅

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';

(async function() {
  // Fetch config.json
  const configRes = await fetch('config.json?v=' + Date.now());
  const configJson = await configRes.json();
  const typeConfig = configJson.config.types;

  // Fetch all nodes from data.json
  const response = await fetch('data.json?v=' + Date.now());
  const allData = await response.json();
  const nodes = allData;

  // Generate links randomly for demo (since links field is empty)
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    if (i % 5 === 0 && i > 0) {
      links.push({ source: nodes[i].id, target: nodes[i - 1].id });
    }
    if (i % 7 === 0 && i > 1) {
      links.push({ source: nodes[i].id, target: nodes[i - 2].id });
    }
  }

  // Setup three.js scene
  const width = window.innerWidth;
  const height = window.innerHeight - 56; // minus navbar
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222);

  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 200;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);

  // Remove previous canvas and append new one
  const canvasDiv = document.getElementById('canvas');
  canvasDiv.innerHTML = '';
  canvasDiv.appendChild(renderer.domElement);

  // 立体感のためのライト（左上から）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(-100, 100, 100);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.7); // 少しだけ全体を明るく
  scene.add(ambientLight);

  // Position nodes randomly in 3D space
  const nodeMeshes = [];
  nodes.forEach((node, i) => {
    node.x = Math.random() * 180 - 90;
    node.y = Math.random() * 120 - 60;
    node.z = Math.random() * 180 - 90;

    // typeごとのサイズ・色
    const type = node.type && typeConfig[node.type] ? node.type : 'project';
    const size = (typeConfig[type]?.size ?? 100) / 30; // サイズ調整
    const color = typeConfig[type]?.color ?? '#ffd700';

    // status=errorは赤, warningは黄
    let material;
    if (node.status === 'error') {
      material = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 80 });
    } else if (node.status === 'warning') {
      material = new THREE.MeshPhongMaterial({ color: 0xffff00, shininess: 80 });
    } else {
      material = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });
    }

    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(node.x, node.y, node.z);
    mesh.userData = node;
    scene.add(mesh);
    nodeMeshes.push(mesh);

    // --- ノード名ラベルを追加 ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '16px sans-serif';
    const text = node.name || node.id;
    const textWidth = ctx.measureText(text).width;
    canvas.width = textWidth + 16;
    canvas.height = 32;
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width / 8, canvas.height / 8, 1); // サイズ調整
    sprite.position.set(node.x, node.y + size + 8, node.z); // 球体の上に表示
    scene.add(sprite);

    // ノード生成時にlabelSpriteをmeshに紐付け
    mesh.labelSprite = sprite;
  });

  // Draw links as lines
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode && targetNode) {
      const points = [
        new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
        new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: 0x8888ff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
    }
  });

  // Simple orbit controls (experimental, minimal)
  let isDragging = false, prevX = 0, prevY = 0;
  renderer.domElement.addEventListener('mousedown', e => {
    isDragging = true; prevX = e.clientX; prevY = e.clientY;
  });
  renderer.domElement.addEventListener('mouseup', () => { isDragging = false; });
  renderer.domElement.addEventListener('mousemove', e => {
    if (isDragging) {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      scene.rotation.y += dx * 0.005;
      scene.rotation.x += dy * 0.005;
      prevX = e.clientX; prevY = e.clientY;
    }
  });

  // マウスホイールでズームイン・ズームアウト
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.2;
    camera.position.z = Math.max(30, Math.min(1000, camera.position.z));
  });

  // グラデーション背景をCanvasで作成
  function createGradientTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#222a44');
    grad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return new THREE.CanvasTexture(canvas);
  }
  scene.background = createGradientTexture();

  // 星を追加する関数
  function addStars(numStars = 200) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < numStars; i++) {
      positions.push(
        (Math.random() - 0.5) * 1000,
        (Math.random() - 0.5) * 1000,
        (Math.random() - 0.5) * 1000
      );
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
  }
  addStars();

  // Animation loop & error/warning node blinking (slow blink)
  let blink = false;
  let lastBlinkTime = 0;
  const blinkInterval = 250; // 0.25秒ごとに点滅

  function animate(now) {
    requestAnimationFrame(animate);

    // 点滅: errorノードは赤⇔暗色, warningノードは黄⇔暗色（1秒周期）
    if (!lastBlinkTime) lastBlinkTime = now;
    if (now - lastBlinkTime > blinkInterval) {
      blink = !blink;
      lastBlinkTime = now;
      nodeMeshes.forEach(mesh => {
        if (mesh.userData.status === 'error') {
          mesh.material.color.set(blink ? 0xff0000 : 0x222222);
        } else if (mesh.userData.status === 'warning') {
          mesh.material.color.set(blink ? 0xffff00 : 0x222222);
        }
      });
    }

    renderer.render(scene, camera);
  }
  animate();

  // Raycasterでクリックノード検出
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMesh = null;

  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeMeshes);

    // 既存選択を戻す
    if (selectedMesh) {
      selectedMesh.scale.set(1, 1, 1);
      selectedMesh.material.shininess = 80;
      selectedMesh.material.emissive.setHex(0x000000);
      // ラベルも通常サイズに
      if (selectedMesh.labelSprite) selectedMesh.labelSprite.scale.set(selectedMesh.labelSprite.scale.x / 1.5, selectedMesh.labelSprite.scale.y / 1.5, 1);
    }

    if (intersects.length > 0) {
      selectedMesh = intersects[0].object;
      // 拡大・光沢・発光
      selectedMesh.scale.set(1.5, 1.5, 1.5);
      selectedMesh.material.shininess = 150;
      selectedMesh.material.emissive.setHex(0x4444ff);
      // ラベル拡大
      if (selectedMesh.labelSprite) selectedMesh.labelSprite.scale.set(selectedMesh.labelSprite.scale.x * 1.5, selectedMesh.labelSprite.scale.y * 1.5, 1);
      // 詳細パネル表示
      showDetailPanel(selectedMesh.userData);
    } else {
      hideDetailPanel();
      selectedMesh = null;
    }
  });

  // 詳細パネル表示関数
  function showDetailPanel(node) {
    let panel = document.getElementById('node-detail-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'node-detail-panel';
      panel.style.position = 'fixed';
      panel.style.top = '20px';
      panel.style.right = '20px';
      panel.style.background = '#fff';
      panel.style.borderRadius = '8px';
      panel.style.padding = '16px';
      panel.style.boxShadow = '0 2px 8px #0002';
      panel.style.zIndex = 2000;
      document.body.appendChild(panel);
    }
    // nameも表示
    panel.innerHTML = `<b>${node.name || node.id}</b><br>id: ${node.id}<br>name: ${node.name}<br>type: ${node.type}<br>status: ${node.status || 'normal'}`;
    panel.style.display = 'block';
  }
  function hideDetailPanel() {
    const panel = document.getElementById('node-detail-panel');
    if (panel) panel.style.display = 'none';
  }
})();