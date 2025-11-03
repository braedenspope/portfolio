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

  // Use the *true* image aspect for bounds: [ [y0,x0], [y1,x1] ]
  const bounds = [[0, 0], [h, w]];
  L.imageOverlay(MAP_IMG, bounds, { opacity: 1 }).addTo(map);

  // Optional: confine panning to the image
  map.setMaxBounds(bounds);
  map.fitBounds(bounds);

  // Center test pin so you can verify geometry looks right
  L.marker(L.latLng(h / 2, w / 2)).addTo(map).bindPopup('Center');

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
