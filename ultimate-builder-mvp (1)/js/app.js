// Ultimate Builder – MVP
// Three.js + d3-force-3d + simple heuristics advisor
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { ForceGraph3D } from 'https://unpkg.com/3d-force-graph@1.73.2/dist/3d-force-graph.module.js';

const state = {
  nodes: [],
  links: [],
  nodeByName: new Map(),
  webllmEnabled: false
};

// Bootstrap scene via 3d-force-graph (wraps Three.js)
const canvas = document.getElementById('three-canvas');
const Graph = ForceGraph3D({
  extraRenderers: []
})(canvas);

Graph
  .backgroundColor('rgba(0,0,0,0)')
  .nodeLabel(n => `${n.name}\n${n.type} • ${n.cpu}C/${n.ram}GB • Net ${n.net}Gbps • VRAM ${n.vram}GB`)
  .nodeVal(n => 6 + Math.min(30, (n.ram||0)/8 + (n.vram||0)/4))
  .nodeThreeObject(node => {
    const group = new THREE.Group();
    const color = typeColor(node.type);
    const geo = new THREE.SphereGeometry(6, 24, 24);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.3 });
    const sphere = new THREE.Mesh(geo, mat);
    group.add(sphere);
    // label
    const sprite = makeTextSprite(node.name);
    sprite.position.set(0, 10, 0);
    group.add(sprite);
    return group;
  })
  .linkColor(l => linkColor(l))
  .linkOpacity(0.9)
  .linkWidth(l => Math.max(0.5, Math.log2((l.bw||1))))
  .d3Force('charge').strength(-140);

const amb = new THREE.AmbientLight(0xffffff, 0.6);
Graph.scene().add(amb);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(30, 50, 40);
Graph.scene().add(dir);

// Helpers
function typeColor(t) {
  switch (t) {
    case 'Head-Server': return 0x49ff00;
    case 'Mini-PC': return 0x52c41a;
    case 'NAS/Storage': return 0x1e90ff;
    case 'Switch': return 0xffb020;
    case 'eGPU': return 0xff4d4f;
    case 'Service (VM/Container)': return 0xb388ff;
    default: return 0x89a2ad;
  }
}
function linkColor(l) {
  if ((l.bw||0) < 10) return 0xff6666;
  if ((l.bw||0) >= 25) return 0x49ff00;
  return 0xffb020;
}
function makeTextSprite(message) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 36;
  ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
  const textWidth = ctx.measureText(message).width;
  canvas.width = textWidth + 40;
  canvas.height = fontSize + 40;
  // bg
  ctx.fillStyle = 'rgba(10,15,18,0.8)';
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 16);
  // text
  ctx.fillStyle = '#e6f1ee';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
  ctx.fillText(message, 20, canvas.height/2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width/6, canvas.height/6, 1);
  return sprite;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  ctx.fill();
}

function updateGraph() {
  Graph.graphData({ nodes: state.nodes, links: state.links });
  document.getElementById('stat-nodes').textContent = String(state.nodes.length);
  document.getElementById('stat-edges').textContent = String(state.links.length);
  runAdvisor();
}

// Advisor (heuristics, instant & free)
function runAdvisor() {
  const advice = [];
  const nodes = state.nodes;
  const links = state.links;

  const hasHead = nodes.some(n => n.type === 'Head-Server');
  const hasNAS = nodes.some(n => n.type === 'NAS/Storage');
  const hasSwitch = nodes.some(n => n.type === 'Switch');

  if (!hasHead) advice.push('Füge einen Head‑Server hinzu (viel RAM, GPU‑Option).');
  if (!hasNAS) advice.push('Füge ein NAS/Storage hinzu (ZFS Mirror/RAIDZ2).');
  if (!hasSwitch) advice.push('Füge einen Switch (10 GbE min.) hinzu und verbinde alle Knoten.');

  // Bandwidth checks
  for (const l of links) {
    const a = state.nodeByName.get(l.source.name || l.source);
    const b = state.nodeByName.get(l.target.name || l.target);
    if (!a || !b) continue;
    if (l.bw < 10 && (a.type === 'Head-Server' || b.type === 'Head-Server' || a.type === 'NAS/Storage' || b.type === 'NAS/Storage')) {
      advice.push(`Link ${a.name} ⇄ ${b.name} mit ${l.bw} Gbps: für Training/Render/Storage‑Traffic zu niedrig → 10–25 GbE.`);
    }
    if (l.media === 'Thunderbolt' && l.bw < 20) {
      advice.push(`TB‑Link ${a.name} ⇄ ${b.name}: prüfe Kabel/Gen (mind. TB4, kurze Kabel für Stabilität).`);
    }
  }

  // GPU hints
  nodes.filter(n => n.type === 'Mini-PC' && n.vram >= 8).forEach(n => {
    advice.push(`${n.name}: Gute GPU‑VRAM‑Basis. Plane PCIe/TB‑Pfad (Passthrough oder eGPU).`);
  });
  // Storage sizing
  const totalRam = nodes.reduce((s,n)=>s+(n.ram||0),0);
  if (totalRam >= 64 && !hasNAS) {
    advice.push('Viel RAM erkannt – ohne NAS fehlen Snapshots/Backups. NAS einplanen.');
  }

  // Dedup & display
  const unique = Array.from(new Set(advice));
  const box = document.getElementById('advice');
  if (state.webllmEnabled) {
    box.innerHTML = 'Local AI aktiv – Heuristik bleibt als Fallback aktiv.<br>' + unique.map(x=>'• '+x).join('<br>');
  } else {
    box.innerHTML = unique.length ? unique.map(x=>'• '+x).join('<br>') : 'Alles sieht solide aus. Erhöhe Bandbreite nur wenn nötig.';
  }
}

// UI bindings
function addNode() {
  const type = document.getElementById('node-type').value;
  const name = (document.getElementById('node-name').value || '').trim();
  const cpu = Number(document.getElementById('node-cpu').value||0);
  const ram = Number(document.getElementById('node-ram').value||0);
  const net = Number(document.getElementById('node-net').value||1);
  const vram = Number(document.getElementById('node-vram').value||0);
  if (!name) return alert('Name ist erforderlich.');
  if (state.nodeByName.has(name)) return alert('Name existiert bereits.');
  const node = { id: name, name, type, cpu, ram, net, vram };
  state.nodes.push(node);
  state.nodeByName.set(name, node);
  updateGraph();
}
function addEdge() {
  const from = (document.getElementById('edge-from').value || '').trim();
  const to = (document.getElementById('edge-to').value || '').trim();
  const bw = Number(document.getElementById('edge-bw').value||1);
  const media = document.getElementById('edge-media').value;
  if (!from || !to) return alert('Von/Nach erforderlich.');
  if (!state.nodeByName.has(from) || !state.nodeByName.has(to)) return alert('Beide Knoten müssen existieren.');
  state.links.push({ source: from, target: to, bw, media });
  updateGraph();
}
document.getElementById('add-node').addEventListener('click', addNode);
document.getElementById('add-edge').addEventListener('click', addEdge);

// Exporters
function exportJSON() {
  const data = {
    nodes: state.nodes,
    links: state.links,
    policy: { redundancy: 'zfs-mirror', backup: 'daily', power_budget_w: 1200 }
  };
  downloadObject(data, 'ultimate-builder.json', 'application/json');
}
function exportYAML() {
  const yaml = toYAML({
    bill_of_materials: bomSuggestion(),
    ansible_targets: state.nodes.filter(n=>['Head-Server','Mini-PC','NAS/Storage'].includes(n.type)).map(n=>n.name),
    links: state.links
  });
  downloadBlob(new Blob([yaml], { type: 'text/yaml' }), 'build-plan.yaml');
}
document.getElementById('export-json').addEventListener('click', exportJSON);
document.getElementById('export-yaml').addEventListener('click', exportYAML);

function bomSuggestion() {
  const have10g = state.links.some(l=>l.bw>=10);
  const gpuNodes = state.nodes.filter(n=>n.vram>=12).length;
  return {
    switch: have10g ? '10GbE 8-Port + 4x DAC' : '2.5GbE Switch (Start)',
    storage: 'ZFS Mirror (2x HDD) + NVMe Cache',
    compute: state.nodes.map(n=>`${n.name}: ${n.cpu}C/${n.ram}GB Net ${n.net}Gbps`),
    gpu: gpuNodes ? `${gpuNodes}x GPU‑fähige Knoten` : 'Optional eGPU/PCIe später'
  };
}

// YAML (tiny)
function toYAML(obj, indent=0) {
  const pad = '  '.repeat(indent);
  if (Array.isArray(obj)) {
    return obj.map(v => pad + '- ' + toYAML(v, indent+1).trimStart()).join('\n');
  } else if (typeof obj === 'object' && obj) {
    return Object.entries(obj).map(([k,v]) => {
      const val = (typeof v === 'object') ? '\n' + toYAML(v, indent+1) : String(v);
      return `${pad}${k}: ${val}`;
    }).join('\n');
  }
  return pad + String(obj);
}

function downloadObject(obj, filename, mime) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: mime });
  downloadBlob(blob, filename);
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

// Seed data
function seed() {
  const seedNodes = [
    {name:'head-01', type:'Head-Server', cpu:16, ram:64, net:10, vram:24},
    {name:'nas-01', type:'NAS/Storage', cpu:4, ram:16, net:10, vram:0},
    {name:'sw-10g', type:'Switch', cpu:0, ram:0, net:10, vram:0},
    {name:'mini-01', type:'Mini-PC', cpu:8, ram:32, net:2.5, vram:0},
    {name:'mini-02', type:'Mini-PC', cpu:8, ram:32, net:2.5, vram:8}
  ];
  const seedLinks = [
    {source:'head-01', target:'sw-10g', bw:10, media:'SFP+/DAC'},
    {source:'nas-01', target:'sw-10g', bw:10, media:'SFP+/DAC'},
    {source:'mini-01', target:'sw-10g', bw:2.5, media:'Ethernet'},
    {source:'mini-02', target:'sw-10g', bw:2.5, media:'Ethernet'}
  ];
  for (const n of seedNodes) { state.nodes.push(n); state.nodeByName.set(n.name,n); }
  state.links.push(...seedLinks);
  updateGraph();
}
seed();

// WebLLM (optional)
const toggle = document.getElementById('toggle-webllm');
toggle.addEventListener('change', async (e) => {
  state.webllmEnabled = e.target.checked;
  if (state.webllmEnabled) {
    // Lazy-load module and try a lightweight model. This is optional and may download large assets.
    try {
      const {CreateMLCEngine} = await import('https://esm.run/@mlc-ai/web-llm@0.2.48');
      const initProgress = (report) => {
        const box = document.getElementById('advice');
        box.innerHTML = 'Lade Local AI… ' + (report?.text || '');
      };
      const engine = await CreateMLCEngine(
        'Llama-3.1-8B-Instruct-q4f32_1-MLC',
        { initProgressCallback: initProgress }
      );
      // Simple prompt using current graph summary
      const summary = JSON.stringify({nodes: state.nodes.length, links: state.links.length});
      const prompt = `Du bist ein Infrastruktur-Assistent. Analysiere: ${summary}. Gib 3 prägnante Empfehlungen.`;
      const reply = await engine.chat.completions.create({
        messages:[{role:'user', content: prompt}],
        stream: false
      });
      const text = reply.choices?.[0]?.message?.content || '';
      document.getElementById('advice').innerHTML = '<b>Local AI:</b> ' + text.replace(/\n/g,'<br>') + '<hr>' + document.getElementById('advice').innerHTML;
    } catch (err) {
      document.getElementById('advice').innerHTML = 'WebLLM konnte nicht geladen werden (Browser/WebGPU/Speicher). Heuristik aktiv.';
      console.error(err);
      state.webllmEnabled = false;
      toggle.checked = false;
    }
  } else {
    runAdvisor();
  }
});

// Resize
function onResize() {
  const w = document.querySelector('#canvas-wrap').clientWidth;
  const h = window.innerHeight - 68;
  Graph.width(w).height(h);
}
window.addEventListener('resize', onResize);
onResize();
