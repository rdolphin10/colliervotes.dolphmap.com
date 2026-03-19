/**
 * PRECINCT-LAYERS.JS - GeoJSON Polygon Rendering + Interaction
 *
 * Loads precinct boundary GeoJSON and renders as interactive polygon layers.
 * Handles hover highlighting, click selection, and search filtering.
 *
 * =========================================================================
 * DATA SWAP INSTRUCTIONS (for Maggie)
 * =========================================================================
 * To replace sample data with real precinct boundaries:
 *
 * 1. Open the shapefile in QGIS or ArcGIS
 * 2. Export/Save As GeoJSON:
 *    - Format: GeoJSON
 *    - CRS: EPSG:4326 (WGS 84)
 *    - File: data/precincts.geojson
 * 3. The GeoJSON must have these property fields (case-sensitive):
 *    - PRECINCT   (string) — precinct number, e.g. "101"
 *    - PrecinctNa (string) — polling location name, e.g. "West Wind Estates Comm Bldg"
 * 4. Just replace data/precincts.geojson — no other code changes needed.
 *
 * In QGIS: Layer > Export > Save Features As > GeoJSON, CRS EPSG:4326
 * In ArcGIS: Export Data > JSON > GeoJSON, Geographic WGS 1984
 * =========================================================================
 */

let precinctData = null;
let hoveredPrecinctId = null;
let pollingMarkers = [];

document.addEventListener('mapReady', function(e) {
    const map = e.detail.map;
    loadPrecincts(map);
});

/**
 * Load GeoJSON and add map layers
 */
function loadPrecincts(map) {
    fetch(CONFIG.data.geojsonPath)
        .then(function(response) {
            if (!response.ok) throw new Error('Failed to load precinct data');
            return response.json();
        })
        .then(function(geojson) {
            // Assign a numeric id to each feature for feature-state hover
            geojson.features.forEach(function(feature, index) {
                feature.id = index;
            });

            precinctData = geojson;

            // Add source
            map.addSource('precincts', {
                type: 'geojson',
                data: geojson,
                generateId: false
            });

            // Fill layer — precinct polygons
            map.addLayer({
                id: 'precinct-fill',
                type: 'fill',
                source: 'precincts',
                paint: {
                    'fill-color': CONFIG.precinctColor,
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.55,
                        ['boolean', ['feature-state', 'selected'], false],
                        0.5,
                        0.25
                    ]
                }
            });

            // Line layer — precinct borders
            map.addLayer({
                id: 'precinct-line',
                type: 'line',
                source: 'precincts',
                paint: {
                    'line-color': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        '#333',
                        ['boolean', ['feature-state', 'selected'], false],
                        '#333',
                        '#555'
                    ],
                    'line-width': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        2.5,
                        ['boolean', ['feature-state', 'selected'], false],
                        2.5,
                        1
                    ]
                }
            });

            // Label layer — precinct numbers
            map.addLayer({
                id: 'precinct-labels',
                type: 'symbol',
                source: 'precincts',
                layout: {
                    'text-field': ['get', 'PRECINCT'],
                    'text-size': [
                        'interpolate', ['linear'], ['zoom'],
                        9, 10,
                        12, 13,
                        15, 16
                    ],
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-allow-overlap': false,
                    'text-ignore-placement': false,
                    'text-padding': 2
                },
                paint: {
                    'text-color': '#1a3a5c',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5
                }
            });

            // Polling location pins — rendered as map-native symbol layer
            createPollingPinImage(map, geojson);

            // Hover interaction
            map.on('mousemove', 'precinct-fill', function(e) {
                if (e.features.length > 0) {
                    // Clear previous hover
                    if (hoveredPrecinctId !== null) {
                        map.setFeatureState(
                            { source: 'precincts', id: hoveredPrecinctId },
                            { hover: false }
                        );
                    }
                    hoveredPrecinctId = e.features[0].id;
                    map.setFeatureState(
                        { source: 'precincts', id: hoveredPrecinctId },
                        { hover: true }
                    );
                    map.getCanvas().style.cursor = 'pointer';
                }
            });

            map.on('mouseleave', 'precinct-fill', function() {
                if (hoveredPrecinctId !== null) {
                    map.setFeatureState(
                        { source: 'precincts', id: hoveredPrecinctId },
                        { hover: false }
                    );
                }
                hoveredPrecinctId = null;
                map.getCanvas().style.cursor = '';
            });

            // Click interaction
            map.on('click', 'precinct-fill', function(e) {
                if (e.features.length > 0) {
                    const feature = e.features[0];
                    selectPrecinct(map, feature);
                }
            });

            // Notify sidebar that data is loaded
            document.dispatchEvent(new CustomEvent('precinctsLoaded', {
                detail: { geojson: geojson }
            }));
        })
        .catch(function(error) {
            console.error('Error loading precincts:', error);
        });
}

/**
 * Select a precinct — highlight on map, show popup, and show detail in sidebar
 */
let selectedPrecinctId = null;
let activePopup = null;

function selectPrecinct(map, feature) {
    // Clear previous selection
    if (selectedPrecinctId !== null) {
        map.setFeatureState(
            { source: 'precincts', id: selectedPrecinctId },
            { selected: false }
        );
    }
    // Close any existing popup
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }

    selectedPrecinctId = feature.id;
    map.setFeatureState(
        { source: 'precincts', id: selectedPrecinctId },
        { selected: true }
    );

    const props = feature.properties;
    const pinLng = parseFloat(props.PinLng);
    const pinLat = parseFloat(props.PinLat);

    // Fit bounds to include BOTH the precinct polygon AND the polling pin
    const bounds = getBounds(feature.geometry);
    if (bounds) {
        const fitBounds = new mapboxgl.LngLatBounds(bounds);
        // Extend to include the polling pin if it's outside the polygon
        if (pinLng && pinLat) {
            fitBounds.extend([pinLng, pinLat]);
        }
        // Use generous padding so the popup is never cut off
        // Extra top padding on mobile for the floating sidebar
        const isMobile = window.innerWidth <= 768;
        map.fitBounds(fitBounds, {
            padding: {
                top: isMobile ? 280 : 120,
                bottom: isMobile ? 80 : 120,
                left: isMobile ? 40 : 100,
                right: isMobile ? 40 : 100
            },
            maxZoom: 14
        });
    }

    // Show popup at the polling pin after the map finishes moving
    if (pinLng && pinLat) {
        setTimeout(function() {
            showPollingPopup(map, [pinLng, pinLat], props);
        }, 800);
    }

    document.dispatchEvent(new CustomEvent('precinctSelected', {
        detail: { properties: props }
    }));
}

/**
 * Show a popup at a polling location
 */
function showPollingPopup(map, lngLat, props) {
    if (activePopup) {
        activePopup.remove();
    }

    const name = props.PrecinctNa || 'Polling Location';
    const address = props.Address || '';
    const precinct = props.PRECINCT || '';

    // Google Maps directions URL
    const directionsUrl = address
        ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(address)
        : '#';

    const html =
        '<div class="polling-popup">' +
            '<div class="polling-popup-badge">Precinct ' + escapePopupHTML(precinct) + '</div>' +
            '<div class="polling-popup-body">' +
                '<div class="polling-popup-name">' + escapePopupHTML(name) + '</div>' +
                (address
                    ? '<div class="polling-popup-address">' +
                        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                            '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
                            '<circle cx="12" cy="9" r="2.5"/>' +
                        '</svg>' +
                        '<span>' + escapePopupHTML(address) + '</span>' +
                      '</div>'
                    : '') +
            '</div>' +
            '<a class="polling-popup-directions" href="' + directionsUrl + '" target="_blank" rel="noopener noreferrer">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polygon points="3 11 22 2 13 21 11 13 3 11"/>' +
                '</svg>' +
                'Get Directions' +
            '</a>' +
        '</div>';

    activePopup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px',
        offset: 15
    })
    .setLngLat(lngLat)
    .setHTML(html)
    .addTo(map);

    activePopup.on('close', function() {
        activePopup = null;
    });
}

/**
 * Escape HTML for popup content — regex-based (avoids DOM element creation per call)
 */
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapePopupHTML(str) {
    return String(str).replace(/[&<>"']/g, function(c) { return _escapeMap[c]; });
}

/**
 * Clear precinct selection
 */
function clearSelection() {
    const map = getMap();
    if (selectedPrecinctId !== null && map) {
        map.setFeatureState(
            { source: 'precincts', id: selectedPrecinctId },
            { selected: false }
        );
        selectedPrecinctId = null;
    }
    if (activePopup) {
        activePopup.remove();
        activePopup = null;
    }
}

/**
 * Select a precinct by precinct number (called from sidebar list click)
 */
function selectPrecinctByNumber(precinctNumber) {
    const map = getMap();
    if (!map || !precinctData) return;

    const feature = precinctData.features.find(function(f) {
        return f.properties.PRECINCT === precinctNumber;
    });

    if (feature) {
        selectPrecinct(map, feature);
    }
}

/**
 * Filter precincts by search term
 */
function filterPrecincts(searchTerm) {
    const map = getMap();
    if (!map || !map.getLayer('precinct-fill')) return;

    if (!searchTerm) {
        // Clear filter — show all
        map.setFilter('precinct-fill', null);
        map.setFilter('precinct-line', null);
        map.setFilter('precinct-labels', null);
        if (map.getLayer('polling-pins')) map.setFilter('polling-pins', null);
        return;
    }

    const term = searchTerm.toLowerCase();

    // Find matching precinct IDs
    const matchingPrecincts = precinctData.features
        .filter(function(f) {
            const num = (f.properties.PRECINCT || '').toLowerCase();
            const name = (f.properties.PrecinctNa || '').toLowerCase();
            return num.includes(term) || name.includes(term);
        })
        .map(function(f) {
            return f.properties.PRECINCT;
        });

    // Apply filter
    const filter = ['in', ['get', 'PRECINCT'], ['literal', matchingPrecincts]];
    map.setFilter('precinct-fill', filter);
    map.setFilter('precinct-line', filter);
    map.setFilter('precinct-labels', filter);
    if (map.getLayer('polling-pins')) map.setFilter('polling-pins', filter);

    return matchingPrecincts;
}

/**
 * Compute bounding box from a geometry
 */
function getBounds(geometry) {
    const coords = getAllCoordinates(geometry);
    if (coords.length === 0) return null;

    let minLng = Infinity, minLat = Infinity;
    let maxLng = -Infinity, maxLat = -Infinity;

    coords.forEach(function(c) {
        if (c[0] < minLng) minLng = c[0];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[1] > maxLat) maxLat = c[1];
    });

    return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * Extract all coordinate pairs from a geometry
 */
function getAllCoordinates(geometry) {
    const coords = [];
    if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(function(ring) {
            ring.forEach(function(c) { coords.push(c); });
        });
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(function(polygon) {
            polygon.forEach(function(ring) {
                ring.forEach(function(c) { coords.push(c); });
            });
        });
    }
    return coords;
}

/**
 * Create a ballot box icon as a map image and add symbol layer
 */
function createPollingPinImage(map, geojson) {
    // Build point features from GeoJSON properties
    const pinFeatures = geojson.features
        .filter(function(f) { return f.properties.PinLng && f.properties.PinLat; })
        .map(function(f) {
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [f.properties.PinLng, f.properties.PinLat]
                },
                properties: {
                    PRECINCT: f.properties.PRECINCT,
                    PrecinctNa: f.properties.PrecinctNa,
                    Address: f.properties.Address || ''
                }
            };
        });

    map.addSource('polling-pins', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: pinFeatures }
    });

    // Draw the ballot box SVG onto a canvas and add as map image
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const svgStr =
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">' +
            '<rect x="3" y="10" width="18" height="12" rx="2" fill="%23ed1c24" stroke="%23fff" stroke-width="1.2"/>' +
            '<rect x="8" y="9" width="8" height="2" rx="0.5" fill="%23b71c1c"/>' +
            '<rect x="9.5" y="3" width="5" height="8" rx="0.5" fill="%23fff" stroke="%23ed1c24" stroke-width="0.8"/>' +
            '<path d="M10.8 7.5 L11.5 8.5 L13.2 5.8" stroke="%23ed1c24" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
        '</svg>';

    img.onload = function() {
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);

        map.addImage('ballot-icon', imageData, { pixelRatio: 2 });

        // Symbol layer — locked to the map
        map.addLayer({
            id: 'polling-pins',
            type: 'symbol',
            source: 'polling-pins',
            layout: {
                'icon-image': 'ballot-icon',
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    9, 0.5,
                    12, 0.7,
                    14, 0.9
                ],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            }
        });

        // Click on pin — select the precinct
        map.on('click', 'polling-pins', function(e) {
            if (e.features.length > 0) {
                const props = e.features[0].properties;
                const polyFeature = precinctData.features.find(function(f) {
                    return f.properties.PRECINCT === props.PRECINCT;
                });
                if (polyFeature) {
                    selectPrecinct(map, polyFeature);
                }
            }
        });

        map.on('mouseenter', 'polling-pins', function() {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'polling-pins', function() {
            map.getCanvas().style.cursor = '';
        });
    };

    img.src = 'data:image/svg+xml;charset=utf-8,' + svgStr;
}
