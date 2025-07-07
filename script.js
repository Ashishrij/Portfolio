document.querySelectorAll('nav a').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

const map = L.map('map').setView([27.6, 85.3], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const educationPOIs = [
  { name: "Home - Chhaimale", type: "Home", coords: [27.59233, 85.26010] },
  { name: "Green Hill School", type: "School", coords: [27.60870377512003, 85.26614639072862] },
  { name: "Bernhardt H.S School & College", type: "College", coords: [27.685647182665793, 85.29681450985778] },
  { name: "Kathmandu University", type: "University", coords: [27.619527688658486, 85.53879165403045] }
];

let bufferLayers = [];
let emergencyDots = [];
let poiMarkers = [];

function clearMap() {
  bufferLayers.forEach(l => map.removeLayer(l));
  bufferLayers = [];
  emergencyDots.forEach(m => map.removeLayer(m));
  emergencyDots = [];
  poiMarkers.forEach(m => map.removeLayer(m));
  poiMarkers = [];
  document.getElementById('summary').innerHTML = "";
}

function fetchEmergency(lat, lng, radiusMeters) {
  const overpassURL = 'https://overpass-api.de/api/interpreter';
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"hospital|clinic"](around:${radiusMeters},${lat},${lng});
      way["amenity"~"hospital|clinic"](around:${radiusMeters},${lat},${lng});
      node["amenity"="police"](around:${radiusMeters},${lat},${lng});
      way["amenity"="police"](around:${radiusMeters},${lat},${lng});
      node["amenity"="fire_station"](around:${radiusMeters},${lat},${lng});
      way["amenity"="fire_station"](around:${radiusMeters},${lat},${lng});
      node["police"="traffic_police"](around:${radiusMeters},${lat},${lng});
      way["police"="traffic_police"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;
  return fetch(overpassURL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  }).then(res => res.json()).then(data => data.elements);
}

function loadBuffer() {
  const distanceMeters = parseFloat(document.getElementById('bufferDistance').value);
  clearMap();

  let emergencySummary = { hospital: 0, police: 0, fire_station: 0 };

  educationPOIs.forEach(async (poi) => {
    const latlng = [poi.coords[0], poi.coords[1]];
    const center = turf.point([poi.coords[1], poi.coords[0]]);
    const buffer = turf.buffer(center, distanceMeters, { units: 'meters' });

    const bufferLayer = L.geoJSON(buffer, {
      style: { color: '#009688', weight: 2, fillOpacity: 0.2 }
    }).addTo(map);
    bufferLayers.push(bufferLayer);

    const results = await fetchEmergency(latlng[0], latlng[1], distanceMeters);
    let isSafe = results.length > 0;

    let nearbyCounts = { hospital: 0, police: 0, fire_station: 0 };
    results.forEach(el => {
      let type = el.tags?.amenity;

      if (el.tags?.police === 'traffic_police') {
        type = 'police';
      }
      if (type === 'clinic') {
        type = 'hospital';
      }
      if (type && nearbyCounts[type] !== undefined) {
        nearbyCounts[type]++;
        emergencySummary[type]++;
      }
    });

    const marker = L.marker(latlng, { riseOnHover: true }).addTo(map);
    const popupContent = `📍 ${poi.name}<br>🏫 ${poi.type}<br>${isSafe ? '✅ Safe' : '❌ Not Safe'}<br>
      🏥 Hospital: ${nearbyCounts.hospital}<br>
      🚓 Police: ${nearbyCounts.police}<br>
      🚒 Fire Station: ${nearbyCounts.fire_station}`;
    marker.bindPopup(popupContent).openPopup();
    poiMarkers.push(marker);

    if (map.getZoom() >= 13) {
      results.forEach(el => {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (lat && lon) {
          const dot = L.circleMarker([lat, lon], {
            radius: 4,
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.8,
            weight: 1
          }).addTo(map);

          const popupText = `
            🆘 <strong>${el.tags?.amenity || 'Unknown'}</strong><br>
            🏷️ ${el.tags?.name || 'Unnamed'}<br>
            📍 Lat: ${lat.toFixed(5)}, Lng: ${lon.toFixed(5)}
          `;
          dot.bindPopup(popupText);

          emergencyDots.push(dot);
        }
      });
    }

    const summaryHTML = `
      <h3>Total Emergency Services Found</h3>
      <ul>
        <li>Hospital: ${emergencySummary.hospital}</li>
        <li>Police: ${emergencySummary.police}</li>
        <li>Fire Station: ${emergencySummary.fire_station}</li>
      </ul>
    `;
    document.getElementById('summary').innerHTML = summaryHTML;
  });
}

window.onload = () => {
  loadBuffer();
};

    const routeMap = L.map('routeMap').setView([27.6, 85.3], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(routeMap);

    const eduLocations = {
      home: {
        name: "Home - Chhaimale",
        coords: [27.59233, 85.26010]
      },
      school: {
        name: "Green Hill School",
        coords: [27.60870377512003, 85.26614639072862]
      },
      college: {
        name: "Bernhardt H.S School & College",
        coords: [27.685647182665793, 85.29681450985778]
      },
      university: {
        name: "Kathmandu University",
        coords: [27.619527688658486, 85.53879165403045]
      }
    };

    let currentRouteLine = null;

    async function loadEmergencyPoints(type) {
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="${type}"](27.5,85.2,27.7,85.6);
          way["amenity"="${type}"](27.5,85.2,27.7,85.6);
          ${type === 'police' ? 'node["police"="traffic_police"](27.5,85.2,27.7,85.6);' : ''}
          ${type === 'police' ? 'way["police"="traffic_police"](27.5,85.2,27.7,85.6);' : ''}
          ${type === 'hospital' ? 'node["amenity"="clinic"](27.5,85.2,27.7,85.6);' : ''}
          ${type === 'hospital' ? 'way["amenity"="clinic"](27.5,85.2,27.7,85.6);' : ''}
        );
        out center;
      `;
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      const data = await response.json();
      const features = data.elements.map(el => {
        const coords = el.type === 'node' ? [el.lon, el.lat] : [el.center.lon, el.center.lat];
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: coords
          },
          properties: {
            name: el.tags.name || 'Unnamed',
            type: el.tags.amenity || el.tags.police || 'unknown'
          }
        };
      });
      return turf.featureCollection(features);
    }

    async function findNearestEmergencyRoute() {
      const selectedKey = document.getElementById("sourceSelector").value;
      const selectedType = document.getElementById("emergencyType").value;
      const source = eduLocations[selectedKey];
      const fromPoint = turf.point([source.coords[1], source.coords[0]]);

      const emergencyData = await loadEmergencyPoints(selectedType);
      const nearest = turf.nearestPoint(fromPoint, emergencyData);

      if (currentRouteLine) routeMap.removeControl(currentRouteLine);

      currentRouteLine = L.Routing.control({
        waypoints: [
          L.latLng(source.coords[0], source.coords[1]),
          L.latLng(nearest.geometry.coordinates[1], nearest.geometry.coordinates[0])
        ],
        show: true,
        addWaypoints: false,
        routeWhileDragging: false,
        draggableWaypoints: false
      }).addTo(routeMap);

      L.popup()
        .setLatLng([nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]])
        .setContent(`Nearest ${selectedType.replace('_', ' ')}: <br><strong>${nearest.properties.name}</strong>`)
        .openOn(routeMap);
    }

 

  const ktmmap = L.map('ktmmap').setView([27.71, 85.32], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(ktmmap);

const zoomThreshold = 11;

let kathmanduFeature;
let emergencyLayer, tourismLayer, localUnitLayer;
let emergencyCounts = { hospital: 0, clinic: 0, police: 0, fire_station: 0 };
let tourismCounts = {}; // Tourism categories counter

const populationData = {
  "Budhanilakantha": { population: 177557 },
  "Chandragiri": { population: 136928 },
  "Dakshinkali": { population: 24056 },
  "Gokarneshwor": { population: 151200 },
  "Kageshwori Manahora": { population: 133327 },
  "Kathmandu": { population: 845767 },
  "Kirtipur": { population: 81782 },
  "Nagarjun": { population: 115507 },
  "Shankharapur": { population: 78325 },
  "Tarakeshwor": { population: 151508 },
  "Tokha": { population: 135741 }
};

const controls = L.control({ position: 'topright' });
controls.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
  div.innerHTML = `<label style="background:white;padding:2px;display:block;"><input type="checkbox" id="toggleEmergency" checked> Emergency</label>
                   <label style="background:white;padding:2px;display:block;"><input type="checkbox" id="toggleTourism"> Tourism</label>
                   <label style="background:white;padding:2px;display:block;"><input type="checkbox" id="toggleLocal"> Local Units</label>`;
  return div;
};
controls.addTo(ktmmap);

fetch('ktm.geojson')
  .then(res => res.json())
  .then(data => {
    const layer = L.geoJSON(data, {
      style: {
        color: '#0000ff', weight: 3, opacity: 1, fillOpacity: 0.1
      },
      onEachFeature: (feature, lyr) => {
        lyr.on('click', e => showPopup(e.latlng));
      }
    }).addTo(ktmmap);
    kathmanduFeature = data.features[0];
    ktmmap.fitBounds(layer.getBounds());
    fetchEmergencyServices();
    fetchTourismServices();
  });

document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'toggleEmergency') updateEmergencyVisibility();
  else if (id === 'toggleTourism') updateTourismVisibility();
  else if (id === 'toggleLocal') {
    if (e.target.checked) loadLocalUnits();
    else if (localUnitLayer) ktmmap.removeLayer(localUnitLayer);
  }
});

ktmmap.on('zoomend', () => {
  updateEmergencyVisibility();
  updateTourismVisibility();
});

function updateEmergencyVisibility() {
  if (emergencyLayer) {
    if (ktmmap.getZoom() >= zoomThreshold && document.getElementById('toggleEmergency')?.checked) {
      ktmmap.addLayer(emergencyLayer);
    } else {
      ktmmap.removeLayer(emergencyLayer);
    }
  }
}

function updateTourismVisibility() {
  if (tourismLayer) {
    if (ktmmap.getZoom() >= zoomThreshold && document.getElementById('toggleTourism')?.checked) {
      ktmmap.addLayer(tourismLayer);
    } else {
      ktmmap.removeLayer(tourismLayer);
    }
  }
}

function fetchEmergencyServices() {
  const query = `[out:json][timeout:25];(node["amenity"~"hospital|clinic|police|fire_station"](27.6,85.25,27.8,85.4);way["amenity"="fire_station"](27.6,85.25,27.8,85.4);relation["amenity"="fire_station"](27.6,85.25,27.8,85.4););out center tags;`;
  fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query })
    .then(res => res.json())
    .then(json => {
      const inside = json.elements.filter(el => {
        const lon = el.lon || el.center?.lon;
        const lat = el.lat || el.center?.lat;
        if (!lon || !lat) return false;
        const pt = turf.point([lon, lat]);
        return turf.booleanPointInPolygon(pt, kathmanduFeature);
      });
      emergencyCounts = { hospital: 0, clinic: 0, police: 0, fire_station: 0 };
      if (emergencyLayer) ktmmap.removeLayer(emergencyLayer);
      emergencyLayer = L.layerGroup();
      inside.forEach(el => {
        const lon = el.lon || el.center?.lon;
        const lat = el.lat || el.center?.lat;
        const type = el.tags.amenity;
        if (emergencyCounts[type] !== undefined) emergencyCounts[type]++;
        const marker = L.circleMarker([lat, lon], {
          radius: 5, fillColor: "red", color: "white",
          weight: 1, opacity: 1, fillOpacity: 0.8
        }).bindPopup(`<b>${type.replace("_", " ")}</b><br>${el.tags.name || "Unnamed"}<br>Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`);
        emergencyLayer.addLayer(marker);
      });
      updateEmergencyVisibility();
    });
}

function fetchTourismServices() {
  const query = `[out:json][timeout:25];(node["tourism"](27.6,85.25,27.8,85.4););out center tags;`;
  fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: query })
    .then(res => res.json())
    .then(json => {
      const inside = json.elements.filter(el => {
        const lon = el.lon || el.center?.lon;
        const lat = el.lat || el.center?.lat;
        if (!lon || !lat) return false;
        const pt = turf.point([lon, lat]);
        return turf.booleanPointInPolygon(pt, kathmanduFeature);
      });
      tourismCounts = {};
      if (tourismLayer) ktmmap.removeLayer(tourismLayer);
      tourismLayer = L.layerGroup();
      inside.forEach(el => {
        const lon = el.lon || el.center?.lon;
        const lat = el.lat || el.center?.lat;
        const category = el.tags.tourism || "Unknown";
        tourismCounts[category] = (tourismCounts[category] || 0) + 1;
        const marker = L.circleMarker([lat, lon], {
          radius: 5, fillColor: "blue", color: "white",
          weight: 1, opacity: 1, fillOpacity: 0.8
        }).bindPopup(`<b>Type:</b> ${category}<br><b>Name:</b> ${el.tags.name || "Unnamed"}<br>Lat: ${lat.toFixed(4)}, Lng: ${lon.toFixed(4)}`);
        tourismLayer.addLayer(marker);
      });
      updateTourismVisibility();
    });
}

function loadLocalUnits() {
  fetch('ktmlocal.geojson')
    .then(res => res.json())
    .then(data => {
      if (localUnitLayer) ktmmap.removeLayer(localUnitLayer);
      localUnitLayer = L.geoJSON(data, {
        style: { color: '#006400', weight: 2, fillOpacity: 0.1 },
        onEachFeature: function (feature, layer) {
          layer.on('click', () => {
            const name = feature.properties.GaPa_NaPa;
            const area = turf.area(feature) / 1e6;
            const popInfo = populationData[name];
            const density = popInfo ? (popInfo.population / area).toFixed(2) : "N/A";
            const popupText = `<b>${name}</b><br>Area: ${area.toFixed(2)} sq.km<br>` +
              (popInfo ? `Population: ${popInfo.population}<br>Density: ${density} people/sq.km` : 'No population data available');
            layer.bindPopup(popupText).openPopup();
          });
        }
      }).addTo(ktmmap);
    });
}

function showPopup(latlng) {
  if (!kathmanduFeature) return;
  const clickedPoint = turf.point([latlng.lng, latlng.lat]);
  const inside = turf.booleanPointInPolygon(clickedPoint, kathmanduFeature);
  if (!inside) return;
  const area = turf.area(kathmanduFeature) / 1e6;
  let popupText = `<b>You are inside Kathmandu District</b><br>
    Lat: ${latlng.lat.toFixed(4)}, Lng: ${latlng.lng.toFixed(4)}<br>
    Area: ${area.toFixed(2)} sq.km`;

  if (document.getElementById('toggleEmergency')?.checked) {
    popupText += `<br><b>Emergency service counts:</b><br>
      🔴 Hospital: ${emergencyCounts.hospital}<br>
      🏥 Clinic: ${emergencyCounts.clinic}<br>
      👮 Police: ${emergencyCounts.police}<br>
      🚒 Fire Station: ${emergencyCounts.fire_station}`;
  }

  if (document.getElementById('toggleTourism')?.checked) {
    popupText += `<br><b>Tourism sites:</b><br>`;
    for (let type in tourismCounts) {
      popupText += `📍 ${type}: ${tourismCounts[type]}<br>`;
    }
  }

  L.popup().setLatLng(latlng).setContent(popupText).openOn(ktmmap);
}
