// Basic image-map with Leaflet, treating the map image as a 1x1 coordinate space
const MAP_IMG = './img/waterdeep-map.jpg';
const DATA_URL = './data/waterdeep.json';

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: false,
  minZoom: -1,
  maxZoom: 2
});

const bounds = [[0,0],[1000,1000]]; // a virtual 1000x1000 space
const image = L.imageOverlay(MAP_IMG, bounds).addTo(map);
map.fitBounds(bounds);

fetch(DATA_URL).then(r => r.json()).then(init);

const panel = document.getElementById('panel');
const panelContent = document.getElementById('panelContent');
document.getElementById('closePanel').onclick = () => panel.classList.add('hidden');

// helper: normalized coords [0..1, 0..1] -> our 1000-space
function pt([nx, ny]) {
  return L.latLng(1000 * (1 - ny), 1000 * nx); // flip Y so top is 0
}

function init(data) {
  // draw district pins (optional) + location pins
  data.districts.forEach(d => {
    d.locations.forEach(loc => {
      const marker = L.marker(pt(loc.coords), {
        title: loc.name
      }).addTo(map);

      marker.on('click', () => {
        openPanel(renderLocation(loc, d, data));
      });
    });
  });
}

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
      <p class="muted">${district.name} • ${loc.type}</p>

      ${loc.desc ? `<p>${loc.desc}</p>` : ''}

      ${npcs.length ? `
        <h3>Notables</h3>
        <ul>${npcs.map(n => `<li><strong>${n.name}</strong> <span class="tag">${(n.status||'').toUpperCase()}</span></li>`).join('')}</ul>
      ` : ''}

      ${events.length ? `
        <h3>Recorded Events</h3>
        <ul>${events.map(e => `<li><em>${e.title}</em> — ${e.summary}</li>`).join('')}</ul>
      ` : ''}

      ${loc.factions?.length ? `
        <div class="factions">
          ${loc.factions.map(f => `<span class="sigil">${f}</span>`).join('')}
        </div>
      ` : ''}

      <div class="lore">
        <blockquote>
          “The city remembers…”
        </blockquote>
      </div>
    </div>
  `;
}
