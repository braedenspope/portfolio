// Minimal working demo — renders an image map + a test pin
const MAP_IMG = '/waterdeep-atlas/img/waterdeep-map.jpg';     // make sure this file exists
const DATA_URL = '/waterdeep-atlas/data/waterdeep.json';      // optional for now

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -1,
  maxZoom: 2
});

// Virtual 1000x1000 coordinate space for the image
const bounds = [[0,0],[1000,1000]];
L.imageOverlay(MAP_IMG, bounds).addTo(map);
map.fitBounds(bounds);

// Test pin at center so you know Leaflet is working
L.marker(L.latLng(500, 500)).addTo(map).bindPopup('Center test pin');

// Optional: try loading your data to verify the path (won’t break the map if missing)
fetch(DATA_URL).then(r => {
  if (!r.ok) throw new Error('Cannot load waterdeep.json');
  return r.json();
}).then(data => console.log('Loaded JSON:', data))
  .catch(err => console.warn('JSON load issue:', err.message));
