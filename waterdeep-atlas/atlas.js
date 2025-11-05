const MAP_IMG = '/waterdeep-atlas/img/waterdeep-map.jpg';
const DATA_URL = '/waterdeep-atlas/data/waterdeep.json';

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -2,
  maxZoom: 4,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 80
});

const DM_MODE = new URLSearchParams(location.search).get('dm') === '1';
function isRevealed(npc) { return DM_MODE || npc.revealed !== false; }


// Where you'll put images: /waterdeep-atlas/img/npcs/<npc-id>.jpg (or .png)
// Provide one generic placeholder image named _placeholder.jpg (or .png)
function npcImageSrc(id) {
  return `/waterdeep-atlas/characters/img/npcs/${id}.jpg`;
}

function renderNPC(npc, data) {
  if (!npc) return '<p>Missing NPC data.</p>';
  const factions = (npc.factions || []).map(fid => {
    const f = (data.factions || []).find(ff => ff.id === fid.toLowerCase()) || { name: fid };
    return `<span class="sigil">${f.name}</span>`;
  }).join(' ');
  return `
    <div class="card npc-card">
      <div class="npc-hero">
        <img src="${npcImageSrc(npc.id)}" alt="${npc.name}"onerror="this.onerror=null;this.src='./img/npcs/_placeholder.jpg'">
      </div>
      <h2>${npc.name}</h2>
      <p class="muted">${npc.role || ''} ${npc.alignment ? '• ' + npc.alignment : ''} ${npc.status ? '• ' + npc.status : ''}</p>
      ${factions ? `<div class="factions">${factions}</div>` : ''}
      ${npc.summary ? `<p>${npc.summary}</p>` : ''}
    </div>
  `;
}


// Load the image to read its actual size
const img = new Image();
img.src = MAP_IMG;
img.onload = () => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
    
  // --- DEV MODE: click to get normalized [x, y] and drop a temp marker --- //
    const params = new URLSearchParams(location.search);
    if (params.get('dev') === '1') {
    const devHud = document.createElement('div');
    devHud.style.position = 'absolute';
    devHud.style.left = '8px';
    devHud.style.bottom = '8px';
    devHud.style.padding = '6px 8px';
    devHud.style.background = 'rgba(0,0,0,0.6)';
    devHud.style.color = '#ffe7b3';
    devHud.style.font = '12px/1.2 monospace';
    devHud.style.border = '1px solid #b79b6f';
    devHud.style.borderRadius = '6px';
    devHud.style.zIndex = 9999;
    devHud.textContent = 'Click map to get normalized coords…';
    document.querySelector('.atlas-wrap').appendChild(devHud);

    let ghost;
    map.on('click', (e) => {
        const y = e.latlng.lat;     // pixel-space (0..h)
        const x = e.latlng.lng;     // pixel-space (0..w)
        const nx = +(x / w).toFixed(4);
        const ny = +(1 - (y / h)).toFixed(4); // flip Y for top-origin

        const text = `[${nx}, ${ny}]`;
        devHud.textContent = `coords: ${text}  (copied)`;

        if (ghost) map.removeLayer(ghost);
        ghost = L.marker(e.latlng, { draggable: true }).addTo(map).bindPopup(text).openPopup();

        // Copy to clipboard
        navigator.clipboard?.writeText(text).catch(()=>{});

        // Also log normalized coords on drag end for fine tuning
        ghost.on('dragend', () => {
        const ll = ghost.getLatLng();
        const nx2 = +(ll.lng / w).toFixed(4);
        const ny2 = +(1 - (ll.lat / h)).toFixed(4);
        const t2 = `[${nx2}, ${ny2}]`;
        ghost.setPopupContent(t2).openPopup();
        devHud.textContent = `coords: ${t2}  (copied)`;
        navigator.clipboard?.writeText(t2).catch(()=>{});
        });
    });
    }


  // Use the *true* image aspect for bounds: [ [y0,x0], [y1,x1] ]
  const bounds = [[0, 0], [h, w]];
  L.imageOverlay(MAP_IMG, bounds, { opacity: 1 }).addTo(map);

  // Optional: confine panning to the image
  map.setMaxBounds(bounds);
  map.fitBounds(bounds);

  // If you have normalized coords in your JSON (0..1),
  // convert them to pixel-space using the real w/h:
  const pt = ([nx, ny]) => L.latLng(h * (1 - ny), w * nx); // flip Y so 0 is top

  // Load data and plot locations (optional until your JSON is in place)
  fetch(DATA_URL)
    .then(r => r.ok ? r.json() : Promise.reject('Cannot load waterdeep.json'))
    .then(data => {
      data.districts.forEach(d => {
        (d.locations || []).forEach(loc => {
          if (!loc.coords) return;
          L.marker(pt(loc.coords), { title: loc.name })
            .addTo(map)
            .on('click', () => openPanel(renderLocation(loc, d, data)));
        });
      });
    })
    .catch(err => console.warn(err));

    // Handle clicks on NPC names inside the panel
    panel.addEventListener('click', (e) => {
    const btn = e.target.closest('.npc-link');
    if (!btn) return;
    const id = btn.getAttribute('data-npc');
    fetch(DATA_URL).then(r => r.json()).then(data => {
        const npc = (data.npcs || []).find(n => n.id === id);
        if (!npc) return;
        // update URL (optional deep-link)
        const url = new URL(location.href);
        url.searchParams.set('npc', id);
        history.replaceState(null, '', url.toString());
        openPanel(renderNPC(npc, data));
    });
    });

    // Deep-link: if ?npc=<id> is present, open that NPC immediately
    const urlParams = new URLSearchParams(location.search);
    const deepNPC = urlParams.get('npc');
    if (deepNPC) {
    fetch(DATA_URL).then(r => r.json()).then(data => {
        const npc = (data.npcs || []).find(n => n.id === deepNPC);
        if (npc) openPanel(renderNPC(npc, data));
    });
    }

};

const panel = document.getElementById('panel');
const panelContent = document.getElementById('panelContent');
document.getElementById('closePanel').onclick = () => panel.classList.add('hidden');

function openPanel(html) {
  panelContent.innerHTML = html;
  panel.classList.remove('hidden');
}

function renderLocation(loc, district, data) {
  const npcs = (loc.npcs || [])
    .map(id => data.npcs.find(n => n.id.toLowerCase() === id.toLowerCase()))
    .filter(Boolean)
    .filter(isRevealed);
  const events = (loc.events || [])
    .map(id => data.events.find(e => e.id === id))
    .filter(Boolean);

  return `
    <div class="card">
      <h2>${loc.name}</h2>
      <p class="muted">${district.name} • ${loc.type || ''}</p>
      ${loc.desc ? `<p>${loc.desc}</p>` : ''}

      ${npcs.length ? `
        <h3>Notables</h3>
        <ul class="npc-list">
          ${npcs.map(n => `
            <li>
              <button class="npc-link" data-npc="${n.id}" title="View ${n.name}">
                ${n.name}
              </button>
            </li>`).join('')}
        </ul>
      ` : ''}

      ${events.length ? `
        <h3>Recorded Events</h3>
        <ul>${events.map(e => `<li><em>${e.title}</em> — ${e.summary}</li>`).join('')}</ul>
      ` : ''}

      ${loc.factions?.length ? `
        <div class="factions">
          ${loc.factions.map(fid => {
            const f = (data.factions || []).find(ff => ff.id === fid.toLowerCase());
            return `<span class="sigil">${(f?.name || fid)}</span>`;
          }).join('')}
        </div>
      ` : ''}

    </div>
  `;
}

