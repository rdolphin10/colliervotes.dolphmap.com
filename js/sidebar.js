/**
 * SIDEBAR.JS - Search, Expandable Precinct List
 *
 * Manages the sidebar UI: address search, precinct filtering,
 * and expandable inline precinct details.
 *
 * Performance optimizations:
 * - Event delegation on precinct list (one listener, not 67)
 * - Regex-based HTML escaping (no DOM element per call)
 * - Bounding-box pre-filter for point-in-polygon (fast rejection)
 * - Cached DOM references
 */

let allPrecincts = [];
let activePrecinct = null;

// Cache DOM refs once
const DOM = {};

/**
 * Initialize sidebar when precinct data loads
 */
document.addEventListener('precinctsLoaded', function(e) {
    const geojson = e.detail.geojson;

    // Cache DOM elements
    DOM.precinctCount = document.getElementById('precinct-count');
    DOM.precinctList = document.getElementById('precinct-list');
    DOM.noResults = document.getElementById('no-results');
    DOM.searchInput = document.getElementById('search-input');
    DOM.dirToggle = document.getElementById('directory-toggle');
    DOM.dirSection = document.getElementById('directory-section');
    DOM.sidebar = document.getElementById('sidebar');

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

    DOM.precinctCount.textContent = allPrecincts.length;
    renderPrecinctList(allPrecincts);
    setupSearch();
    setupDirectoryToggle();
    setupListDelegation();
});

/**
 * Handle precinct selection from map click — highlight in list
 */
document.addEventListener('precinctSelected', function(e) {
    highlightListItem(e.detail.properties.PRECINCT);
});

/**
 * Event delegation — single click listener on the list container
 * instead of attaching a listener to each of the 67 items
 */
function setupListDelegation() {
    DOM.precinctList.addEventListener('click', function(e) {
        const item = e.target.closest('.precinct-list-item');
        if (!item) return;

        const precinctNum = item.getAttribute('data-precinct');

        // On mobile, collapse directory so popup is visible
        if (window.innerWidth <= 768) {
            if (!DOM.dirSection.classList.contains('collapsed')) {
                DOM.dirSection.classList.add('collapsed');
                DOM.sidebar.classList.add('auto-height');
            }
        }

        selectPrecinctByNumber(precinctNum);
    });
}

/**
 * Render precinct list — builds HTML once, no per-item event listeners
 */
function renderPrecinctList(precincts) {
    if (precincts.length === 0) {
        DOM.precinctList.innerHTML = '';
        DOM.noResults.style.display = 'block';
        return;
    }

    DOM.noResults.style.display = 'none';

    // Build HTML string in one pass
    let html = '';
    for (let i = 0; i < precincts.length; i++) {
        const p = precincts[i];
        html += '<div class="precinct-list-item' +
            (activePrecinct === p.precinct ? ' active' : '') +
            '" data-precinct="' + escapeAttr(p.precinct) + '">' +
            '<span class="precinct-number">' + escapeHTML(p.precinct) + '</span>' +
            '<span class="precinct-name">' + escapeHTML(p.name) + '</span>' +
        '</div>';
    }
    DOM.precinctList.innerHTML = html;
}

/**
 * Highlight the selected precinct in the list and scroll to it
 */
function highlightListItem(precinctNum) {
    // Clear previous — only remove from one element
    if (activePrecinct) {
        const prev = DOM.precinctList.querySelector('.precinct-list-item[data-precinct="' + activePrecinct + '"]');
        if (prev) prev.classList.remove('active');
    }

    activePrecinct = precinctNum;

    const item = DOM.precinctList.querySelector('.precinct-list-item[data-precinct="' + precinctNum + '"]');
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
    let debounceTimer = null;

    DOM.searchInput.addEventListener('input', function() {
        const term = this.value.trim();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            if (!term) {
                renderPrecinctList(allPrecincts);
                filterPrecincts('');
                DOM.precinctCount.textContent = allPrecincts.length;
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
            DOM.precinctCount.textContent = filtered.length;
        }, 200); // 200ms debounce (was 300ms)
    });
}

/**
 * Directory collapse/expand toggle
 */
function setupDirectoryToggle() {
    DOM.dirToggle.addEventListener('click', function() {
        DOM.dirSection.classList.toggle('collapsed');
        DOM.sidebar.classList.toggle('auto-height', DOM.dirSection.classList.contains('collapsed'));
    });
}

/**
 * Escape HTML to prevent XSS — regex-based (no DOM element creation)
 */
const _sidebarEscapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function(c) { return _sidebarEscapeMap[c]; });
}

/**
 * Escape string for use in HTML attributes
 */
function escapeAttr(str) {
    return String(str).replace(/[&<>"']/g, function(c) { return _sidebarEscapeMap[c]; });
}

/**
 * Address search — geocode an address and find which precinct contains it
 */
let addressGeojson = null;
let precinctBboxIndex = null; // Bounding box index for fast point-in-polygon rejection

document.addEventListener('precinctsLoaded', function(e) {
    addressGeojson = e.detail.geojson;
    buildBboxIndex(addressGeojson);
    setupAddressSearch();
});

/**
 * Pre-compute bounding boxes for each precinct — used to quickly skip
 * precincts that can't possibly contain the query point
 */
function buildBboxIndex(geojson) {
    precinctBboxIndex = geojson.features.map(function(feature) {
        const coords = getAllCoordinates(feature.geometry);
        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;
        for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            if (c[0] < minLng) minLng = c[0];
            if (c[0] > maxLng) maxLng = c[0];
            if (c[1] < minLat) minLat = c[1];
            if (c[1] > maxLat) maxLat = c[1];
        }
        return { minLng: minLng, minLat: minLat, maxLng: maxLng, maxLat: maxLat };
    });
}

function setupAddressSearch() {
    const input = document.getElementById('address-input');
    const btn = document.getElementById('address-search-btn');
    const resultEl = document.getElementById('address-result');
    const suggestionsEl = document.getElementById('address-suggestions');
    let suggestTimer = null;

    // SVG icon string — reuse instead of rebuilding
    const searchSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    function doSearch() {
        const address = input.value.trim();
        if (!address) return;

        btn.disabled = true;
        btn.innerHTML = '...';
        resultEl.className = 'address-search-result';
        resultEl.style.display = 'none';

        const token = CONFIG.mapbox.accessToken;
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
            encodeURIComponent(address) +
            '.json?access_token=' + token +
            '&limit=1&bbox=-82.2,25.7,-80.8,26.5&country=US';

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                btn.disabled = false;
                btn.innerHTML = searchSvg;

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
                btn.innerHTML = searchSvg;
                resultEl.textContent = 'Search failed. Please try again.';
                resultEl.className = 'address-search-result visible error';
                console.error('Address search error:', err);
            });
    }

    btn.addEventListener('click', doSearch);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            hideSuggestions();
            doSearch();
        }
    });

    // Autocomplete suggestions
    input.addEventListener('input', function() {
        const query = this.value.trim();
        clearTimeout(suggestTimer);

        if (query.length < 3) {
            hideSuggestions();
            return;
        }

        suggestTimer = setTimeout(function() {
            fetchSuggestions(query);
        }, 250); // Slightly faster than 300ms
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.address-input-wrapper')) {
            hideSuggestions();
        }
    });

    function fetchSuggestions(query) {
        const token = CONFIG.mapbox.accessToken;
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
            encodeURIComponent(query) +
            '.json?access_token=' + token +
            '&autocomplete=true&limit=5&bbox=-82.2,25.7,-80.8,26.5&country=US&types=address';

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.features || data.features.length === 0) {
                    hideSuggestions();
                    return;
                }
                showSuggestions(data.features);
            })
            .catch(function() {
                hideSuggestions();
            });
    }

    function showSuggestions(features) {
        let html = '';
        for (let i = 0; i < features.length; i++) {
            const f = features[i];
            html += '<div class="address-suggestion-item" data-place="' + escapeAttr(f.place_name) +
                '" data-lng="' + f.center[0] + '" data-lat="' + f.center[1] + '">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>' +
                    '<circle cx="12" cy="9" r="2.5"/>' +
                '</svg>' +
                '<span class="address-suggestion-text">' + escapeHTML(f.place_name) + '</span>' +
            '</div>';
        }
        suggestionsEl.innerHTML = html;
        suggestionsEl.classList.add('visible');

        // Event delegation for suggestion clicks
        suggestionsEl.onclick = function(e) {
            const item = e.target.closest('.address-suggestion-item');
            if (!item) return;
            input.value = item.getAttribute('data-place');
            hideSuggestions();
            doSearch();
        };
    }

    function hideSuggestions() {
        suggestionsEl.classList.remove('visible');
        suggestionsEl.innerHTML = '';
    }
}

/**
 * Find which precinct contains a point — uses bbox pre-filter for speed
 */
function findPrecinctAtPoint(lng, lat) {
    if (!addressGeojson || !precinctBboxIndex) return null;

    for (let i = 0; i < addressGeojson.features.length; i++) {
        // Fast bbox rejection — skip precincts whose bounding box doesn't contain the point
        const bbox = precinctBboxIndex[i];
        if (lng < bbox.minLng || lng > bbox.maxLng || lat < bbox.minLat || lat > bbox.maxLat) {
            continue;
        }

        // Precise point-in-polygon check only for bbox hits
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
