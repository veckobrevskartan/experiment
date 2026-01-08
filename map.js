// map.js (utdrag)
const map = L.map('map').setView([60.0, 15.0], 4);  // Centrera på Sverige-regionen
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
const categoryColors = { TERROR:'#e74c3c', INFRA:'#3498db', /* osv */ };
const markers = [];
events.forEach(ev => {
  const marker = L.circleMarker([ev.lat, ev.lng], { radius:6, color:categoryColors[ev.cat] })
    .bindPopup(`<b>${ev.title}</b><br>${ev.place} (${ev.country})`);
  markers.push({ marker: marker, category: ev.cat });
  marker.addTo(map);
});
// Filtreringslogik: vid kryssruta, lägg till/tar bort markörer från kartan.
