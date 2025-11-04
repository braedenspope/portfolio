const DATA_URL = 'data/waterdeep.json';

function npcImageSrc(id) {
  return `img/npcs/${id}.jpg`;
}

const grid = document.getElementById('grid');
const search = document.getElementById('search');
const factionSel = document.getElementById('faction');

let DATA = { npcs: [], factions: [] };

fetch(DATA_URL).then(r => r.json()).then(data => {
  DATA = data;
  buildFactionFilter(data.factions || []);
  render(data.npcs || []);

  // deep-link to npc: /characters.html#<id>
  const hash = location.hash?.slice(1);
  if (hash) showOne(hash);
});

search.addEventListener('input', () => applyFilters());
factionSel.addEventListener('change', () => applyFilters());

function buildFactionFilter(factions) {
  factions.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    factionSel.appendChild(opt);
  });
}

function applyFilters() {
  const q = (search.value || '').toLowerCase().trim();
  const fac = factionSel.value;
  const list = (DATA.npcs || []).filter(n => {
    const nameHit = !q || (n.name?.toLowerCase().includes(q) || n.summary?.toLowerCase().includes(q));
    const facHit = !fac || (n.factions || []).map(x => x.toLowerCase()).includes(fac.toLowerCase());
    return nameHit && facHit;
  });
  render(list);
}

function render(list) {
  grid.innerHTML = list.map(npc => card(npc)).join('');
  grid.querySelectorAll('.npc-card').forEach(cardEl => {
    cardEl.addEventListener('click', () => showOne(cardEl.dataset.id));
  });
}

function card(npc) {
  const facs = (npc.factions || []).map(fid => {
    const f = (DATA.factions || []).find(ff => ff.id === fid.toLowerCase());
    return `<span class="sigil">${(f?.name || fid)}</span>`;
  }).join(' ');
  return `
    <div class="card npc-card" data-id="${npc.id}">
      <div class="npc-hero">
        <img src="${npcImageSrc(npc.id)}"alt="${npc.name}"onload="fitNPCImage(this)"onerror="this.onerror=null;this.src='./img/npcs/_placeholder.jpg'; fitNPCImage(this)">
      </div>
      <h2>${npc.name}</h2>
      <p class="muted">${npc.role || ''} ${npc.alignment ? '• ' + npc.alignment : ''} ${npc.status ? '• ' + npc.status : ''}</p>
      ${facs ? `<div class="factions">${facs}</div>` : ''}
      ${npc.summary ? `<p>${npc.summary}</p>` : ''}
      <div style="display:flex; gap:.5rem; margin-top:.4rem;">
        <a class="btn" href="./atlas.html?npc=${npc.id}">View on Map</a>
        <a class="btn" href="#${npc.id}">Link</a>
      </div>
    </div>
  `;
}

function showOne(id) {
  const npc = (DATA.npcs || []).find(n => n.id === id);
  if (!npc) return;
  // Single view mode: only render this NPC (you can turn this into a modal later)
  grid.innerHTML = card(npc);
}
