/**
 * SIDEBAR.JS - Search, Precinct List, and Detail Panel
 *
 * Manages the sidebar UI: search filtering, precinct list display,
 * and detail panel for selected precincts.
 */

let allPrecincts = [];

/**
 * Initialize sidebar when precinct data loads
 */
document.addEventListener('precinctsLoaded', function(e) {
    const geojson = e.detail.geojson;

    // Build sorted precinct list
    allPrecincts = geojson.features.map(function(f) {
        return {
            precinct: f.properties.PRECINCT,
            name: f.properties.PrecinctNa || ''
        };
    }).sort(function(a, b) {
        return parseInt(a.precinct) - parseInt(b.precinct);
    });

    // Update stats
    document.getElementById('precinct-count').textContent = allPrecincts.length;

    // Render full list
    renderPrecinctList(allPrecincts);

    // Set up search
    setupSearch();
});

/**
 * Show precinct detail when a precinct is selected (from map click)
 */
document.addEventListener('precinctSelected', function(e) {
    showDetail(e.detail.properties);
});

/**
 * Render the precinct list in the sidebar
 */
function renderPrecinctList(precincts) {
    const listEl = document.getElementById('precinct-list');
    const noResultsEl = document.getElementById('no-results');

    if (precincts.length === 0) {
        listEl.innerHTML = '';
        noResultsEl.style.display = 'block';
        return;
    }

    noResultsEl.style.display = 'none';

    listEl.innerHTML = precincts.map(function(p) {
        return '<div class="precinct-list-item" data-precinct="' + escapeAttr(p.precinct) + '">' +
            '<span class="precinct-number">' + escapeHTML(p.precinct) + '</span>' +
            '<span class="precinct-name">' + escapeHTML(p.name) + '</span>' +
            '</div>';
    }).join('');

    // Click handler for list items
    listEl.querySelectorAll('.precinct-list-item').forEach(function(item) {
        item.addEventListener('click', function() {
            const precinctNum = this.getAttribute('data-precinct');
            selectPrecinctByNumber(precinctNum);
        });
    });
}

/**
 * Set up search input with debounce
 */
function setupSearch() {
    const input = document.getElementById('search-input');
    let debounceTimer = null;

    input.addEventListener('input', function() {
        const term = this.value.trim();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            if (!term) {
                // Reset to full list
                renderPrecinctList(allPrecincts);
                filterPrecincts('');
                document.getElementById('precinct-count').textContent = allPrecincts.length;
                return;
            }

            // Filter the list
            const termLower = term.toLowerCase();
            const filtered = allPrecincts.filter(function(p) {
                return p.precinct.toLowerCase().includes(termLower) ||
                       p.name.toLowerCase().includes(termLower);
            });

            renderPrecinctList(filtered);
            filterPrecincts(term);
            document.getElementById('precinct-count').textContent = filtered.length;
        }, 300);
    });
}

/**
 * Show the detail panel for a precinct
 */
function showDetail(properties) {
    const listEl = document.getElementById('precinct-list');
    const statsEl = document.getElementById('sidebar-stats');
    const searchEl = document.querySelector('.sidebar-search');
    const detailEl = document.getElementById('detail-panel');
    const noResultsEl = document.getElementById('no-results');

    const addressEl = document.querySelector('.address-search');

    // Hide list, show detail
    listEl.style.display = 'none';
    statsEl.style.display = 'none';
    searchEl.style.display = 'none';
    noResultsEl.style.display = 'none';
    if (addressEl) addressEl.style.display = 'none';
    detailEl.classList.add('active');

    // Populate
    document.getElementById('detail-precinct-number').textContent = properties.PRECINCT || '';
    document.getElementById('detail-polling-location').textContent = properties.PrecinctNa || 'Not available';
    document.getElementById('detail-address').textContent = properties.Address || 'Not available';
}

/**
 * Back button — return to list view
 */
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('detail-back').addEventListener('click', function() {
        hideDetail();
        clearSelection();
    });

    // Mobile toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        toggleBtn.textContent = sidebar.classList.contains('collapsed')
            ? '\u2630 Precincts'
            : '\u2715 Close';
    });
});

/**
 * Hide detail panel, show list view
 */
function hideDetail() {
    const listEl = document.getElementById('precinct-list');
    const statsEl = document.getElementById('sidebar-stats');
    const searchEl = document.querySelector('.sidebar-search');
    const detailEl = document.getElementById('detail-panel');
    const addressEl = document.querySelector('.address-search');

    detailEl.classList.remove('active');
    listEl.style.display = '';
    statsEl.style.display = '';
    searchEl.style.display = '';
    if (addressEl) addressEl.style.display = '';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * Escape string for use in HTML attributes
 */
function escapeAttr(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
}

/**
 * Address search — geocode an address and find which precinct contains it
 */
let addressGeojson = null;

document.addEventListener('precinctsLoaded', function(e) {
    addressGeojson = e.detail.geojson;
    setupAddressSearch();
});

function setupAddressSearch() {
    const input = document.getElementById('address-input');
    const btn = document.getElementById('address-search-btn');
    const resultEl = document.getElementById('address-result');

    function doSearch() {
        const address = input.value.trim();
        if (!address) return;

        btn.disabled = true;
        btn.textContent = '...';
        resultEl.className = 'address-search-result';
        resultEl.style.display = 'none';

        // Geocode via Mapbox
        const query = encodeURIComponent(address);
        const token = CONFIG.mapbox.accessToken;
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + query +
            '.json?access_token=' + token +
            '&limit=1&bbox=-82.2,25.7,-80.8,26.5&country=US';

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.disabled = false;
                btn.innerHTML = '&#8594;';

                if (!data.features || data.features.length === 0) {
                    resultEl.textContent = 'Address not found. Try including city and state.';
                    resultEl.className = 'address-search-result visible error';
                    return;
                }

                const coords = data.features[0].center; // [lng, lat]
                const matchedAddress = data.features[0].place_name;

                // Find which precinct contains this point
                const precinct = findPrecinctAtPoint(coords[0], coords[1]);

                if (precinct) {
                    resultEl.innerHTML =
                        'You are in <span class="address-result-link" data-precinct="' +
                        escapeAttr(precinct.properties.PRECINCT) + '">Precinct ' +
                        escapeHTML(precinct.properties.PRECINCT) + '</span>';
                    resultEl.className = 'address-search-result visible success';

                    // Click the precinct link to select it
                    resultEl.querySelector('.address-result-link').addEventListener('click', function() {
                        selectPrecinctByNumber(this.getAttribute('data-precinct'));
                    });

                    // Add a marker at the searched address
                    addAddressMarker(coords);

                    // Select the precinct
                    selectPrecinctByNumber(precinct.properties.PRECINCT);
                } else {
                    resultEl.textContent = 'This address does not appear to be within a Collier County precinct.';
                    resultEl.className = 'address-search-result visible error';

                    // Still show the point on the map
                    addAddressMarker(coords);
                    const map = getMap();
                    if (map) {
                        map.flyTo({ center: coords, zoom: 13 });
                    }
                }
            })
            .catch(function(err) {
                btn.disabled = false;
                btn.innerHTML = '&#8594;';
                resultEl.textContent = 'Search failed. Please try again.';
                resultEl.className = 'address-search-result visible error';
                console.error('Address search error:', err);
            });
    }

    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch();
    });
}

/**
 * Find which precinct polygon contains a point
 * Uses ray-casting algorithm for point-in-polygon test
 */
function findPrecinctAtPoint(lng, lat) {
    if (!addressGeojson) return null;

    for (let i = 0; i < addressGeojson.features.length; i++) {
        const feature = addressGeojson.features[i];
        if (pointInPolygonFeature(lng, lat, feature.geometry)) {
            return feature;
        }
    }
    return null;
}

/**
 * Test if a point is inside a polygon/multipolygon geometry
 */
function pointInPolygonFeature(lng, lat, geometry) {
    if (geometry.type === 'Polygon') {
        return pointInPolygon(lng, lat, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
        for (let i = 0; i < geometry.coordinates.length; i++) {
            if (pointInPolygon(lng, lat, geometry.coordinates[i])) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Ray-casting point-in-polygon for a single polygon (with holes)
 */
function pointInPolygon(lng, lat, rings) {
    // Check outer ring
    if (!pointInRing(lng, lat, rings[0])) return false;
    // Check holes — point must NOT be in any hole
    for (let i = 1; i < rings.length; i++) {
        if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
}

/**
 * Ray-casting algorithm for a single ring
 */
function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];

        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Add/move a marker showing the searched address location
 */
let addressMarker = null;

function addAddressMarker(coords) {
    const map = getMap();
    if (!map) return;

    if (addressMarker) {
        addressMarker.setLngLat(coords);
    } else {
        const el = document.createElement('div');
        el.style.cssText =
            'width: 14px; height: 14px; background: #231f20; border: 3px solid #fff; ' +
            'border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        addressMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(coords)
            .addTo(map);
    }
}
