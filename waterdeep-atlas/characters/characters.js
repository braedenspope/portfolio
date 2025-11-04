const DATA_URL = '/waterdeep-atlas/data/waterdeep.json';
const DM_MODE = new URLSearchParams(location.search).get('dm') === '1';

function isRevealed(npc) {
  return DM_MODE || npc.revealed !== false; // hidden only if explicitly false
}

// Automatically adjusts the card box to match the actual image ratio
window.fitNPCImage = function (img) {
  const holder = img.closest('.npc-hero');
  if (!holder) return;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w && h) holder.style.aspectRatio = `${w} / ${h}`;
};

function npcImageSrc(id) {
  return `./characters/img/npcs/${id}.jpg`;
}

const grid = document.getElementById('grid');
const search = document.getElementById('search');
const factionSel = document.getElementById('faction');

let DATA = { npcs: [], factions: [] };

fetch(DATA_URL).then(r => r.json()).then(data => {
  DATA = data;
  buildFactionFilter(data.factions || []);
  applyFilters();

  // deep-link to npc: /characters.html#<id>
  const hash = location.hash?.slice(1);
    if (hash && !DM_MODE) history.replaceState(null, '', location.pathname); // strip hidden deep-link in player view
    if (hash && DM_MODE) showOne(hash);
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

  const list = (DATA.npcs || [])
    .filter(isRevealed) // <- hide unrevealed by default
    .filter(n => {
      const nameHit = !q || (n.name?.toLowerCase().includes(q) || n.summary?.toLowerCase().includes(q));
      const facHit  = !fac || (n.factions || []).map(x => x.toLowerCase()).includes(fac.toLowerCase());
      return nameHit && facHit;
    });

  render(list);
}

function render(list) {
  grid.innerHTML = list.map(npc => card(npc)).join('');
//   grid.querySelectorAll('.npc-card').forEach(cardEl => {
//     cardEl.addEventListener('click', () => showOne(cardEl.dataset.id));
//   });
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
    </div>
  `;
}

function showOne(id) {
  const npc = (DATA.npcs || []).find(n => n.id === id);
  if (!npc || (!DM_MODE && npc.revealed === false)) return;  // block in player view
  grid.innerHTML = card(npc);
}
