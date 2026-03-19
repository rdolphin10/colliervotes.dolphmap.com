/**
 * SIDEBAR.JS - Search, Expandable Precinct List
 *
 * Manages the sidebar UI: address search, precinct filtering,
 * and expandable inline precinct details.
 */

let allPrecincts = [];
let activePrecinct = null;

/**
 * Initialize sidebar when precinct data loads
 */
document.addEventListener('precinctsLoaded', function(e) {
    const geojson = e.detail.geojson;

    // Build sorted precinct list with full properties
    allPrecincts = geojson.features.map(function(f) {
        return {
            precinct: f.properties.PRECINCT,
            name: f.properties.PrecinctNa || '',
            address: f.properties.Address || '',
            pinLng: f.properties.PinLng,
            pinLat: f.properties.PinLat
        };
    }).sort(function(a, b) {
        return parseInt(a.precinct) - parseInt(b.precinct);
    });

    document.getElementById('precinct-count').textContent = allPrecincts.length;
    renderPrecinctList(allPrecincts);
    setupSearch();
});

/**
 * Handle precinct selection from map click — highlight in list
 */
document.addEventListener('precinctSelected', function(e) {
    const precinct = e.detail.properties.PRECINCT;
    highlightListItem(precinct);
});

/**
 * Render simple precinct list — click zooms + opens popup
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

    listEl.querySelectorAll('.precinct-list-item').forEach(function(item) {
        item.addEventListener('click', function() {
            selectPrecinctByNumber(this.getAttribute('data-precinct'));
        });
    });

    // Restore active highlight
    if (activePrecinct) {
        highlightListItem(activePrecinct);
    }
}

/**
 * Highlight the selected precinct in the list and scroll to it
 */
function highlightListItem(precinctNum) {
    // Clear previous
    document.querySelectorAll('.precinct-list-item.active').forEach(function(el) {
        el.classList.remove('active');
    });

    activePrecinct = precinctNum;

    const item = document.querySelector('.precinct-list-item[data-precinct="' + precinctNum + '"]');
    if (item) {
        item.classList.add('active');
        setTimeout(function() {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

/**
 * Set up precinct filter search
 */
function setupSearch() {
    const input = document.getElementById('search-input');
    let debounceTimer = null;

    input.addEventListener('input', function() {
        const term = this.value.trim();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            if (!term) {
                renderPrecinctList(allPrecincts);
                filterPrecincts('');
                document.getElementById('precinct-count').textContent = allPrecincts.length;
                return;
            }

            const termLower = term.toLowerCase();
            const filtered = allPrecincts.filter(function(p) {
                return p.precinct.toLowerCase().includes(termLower) ||
                       p.name.toLowerCase().includes(termLower) ||
                       p.address.toLowerCase().includes(termLower);
            });

            renderPrecinctList(filtered);
            filterPrecincts(term);
            document.getElementById('precinct-count').textContent = filtered.length;
        }, 300);
    });
}

/**
 * DOMContentLoaded — directory toggle + mobile toggle
 */
document.addEventListener('DOMContentLoaded', function() {
    // Directory collapse/expand
    const dirToggle = document.getElementById('directory-toggle');
    const dirSection = document.getElementById('directory-section');
    const sidebar = document.getElementById('sidebar');

    dirToggle.addEventListener('click', function() {
        dirSection.classList.toggle('collapsed');
        sidebar.classList.toggle('auto-height', dirSection.classList.contains('collapsed'));
        // Resize map to fill available space
        const map = getMap();
        if (map) {
            setTimeout(function() { map.resize(); }, 50);
        }
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebar-toggle');

    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        toggleBtn.textContent = sidebar.classList.contains('collapsed')
            ? '\u2630 Precincts'
            : '\u2715 Close';
    });
});

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
        btn.innerHTML = '...';
        resultEl.className = 'address-search-result';
        resultEl.style.display = 'none';

        const query = encodeURIComponent(address);
        const token = CONFIG.mapbox.accessToken;
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + query +
            '.json?access_token=' + token +
            '&limit=1&bbox=-82.2,25.7,-80.8,26.5&country=US';

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

                if (!data.features || data.features.length === 0) {
                    resultEl.textContent = 'Address not found. Try including city and state.';
                    resultEl.className = 'address-search-result visible error';
                    return;
                }

                const coords = data.features[0].center;
                const precinct = findPrecinctAtPoint(coords[0], coords[1]);

                if (precinct) {
                    resultEl.innerHTML =
                        'You are in <span class="address-result-link" data-precinct="' +
                        escapeAttr(precinct.properties.PRECINCT) + '">Precinct ' +
                        escapeHTML(precinct.properties.PRECINCT) + '</span>';
                    resultEl.className = 'address-search-result visible success';

                    resultEl.querySelector('.address-result-link').addEventListener('click', function() {
                        selectPrecinctByNumber(this.getAttribute('data-precinct'));
                    });

                    addAddressMarker(coords);
                    selectPrecinctByNumber(precinct.properties.PRECINCT);
                } else {
                    resultEl.textContent = 'This address does not appear to be within a Collier County precinct.';
                    resultEl.className = 'address-search-result visible error';
                    addAddressMarker(coords);
                    const map = getMap();
                    if (map) map.flyTo({ center: coords, zoom: 13 });
                }
            })
            .catch(function(err) {
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
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

function pointInPolygonFeature(lng, lat, geometry) {
    if (geometry.type === 'Polygon') {
        return pointInPolygon(lng, lat, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
        for (let i = 0; i < geometry.coordinates.length; i++) {
            if (pointInPolygon(lng, lat, geometry.coordinates[i])) return true;
        }
    }
    return false;
}

function pointInPolygon(lng, lat, rings) {
    if (!pointInRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
        if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
}

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

let addressMarker = null;

function addAddressMarker(coords) {
    const map = getMap();
    if (!map) return;
    if (addressMarker) {
        addressMarker.setLngLat(coords);
    } else {
        const el = document.createElement('div');
        el.style.cssText =
            'width: 14px; height: 14px; background: #061550; border: 3px solid #fff; ' +
            'border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        addressMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(coords)
            .addTo(map);
    }
}
