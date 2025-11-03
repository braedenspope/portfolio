const MAP_IMG = 'waterdeep-atlas/img/waterdeep-map.jpg';
const DATA_URL = 'waterdeep-atlas/data/waterdeep.json';

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -2,
  maxZoom: 4,
  zoomSnap: 0.25,
  wheelPxPerZoomLevel: 80
});

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
    .filter(Boolean);
  const events = (loc.events || [])
    .map(id => data.events.find(e => e.id === id))
    .filter(Boolean);

  return `
    <div class="card">
      <h2>${loc.name}</h2>
      <p class="muted">${district.name} • ${loc.type || ''}</p>
      ${loc.desc ? `<p>${loc.desc}</p>` : ''}
      ${npcs.length ? `<h3>Notables</h3><ul>${npcs.map(n => `<li><strong>${n.name}</strong></li>`).join('')}</ul>` : ''}
      ${events.length ? `<h3>Recorded Events</h3><ul>${events.map(e => `<li><em>${e.title}</em> — ${e.summary}</li>`).join('')}</ul>` : ''}
    </div>
  `;
}
