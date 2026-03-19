/**
 * PRECINCT-MAP.JS - Map Initialization + Dolph Base Styling
 *
 * Initializes the Mapbox map and applies the Dolph Map Company
 * custom color scheme to the base map tiles.
 *
 * Adapted from InteractiveMapProject/core/js/dolph-style.js
 */

/**
 * Dolph Map Company Color Palette
 */
const DOLPH_COLORS = {
    // Text/Labels
    cityTitles: '#ed1c24',
    roadTitles: '#000000',
    waterwayTitles: '#0072bc',

    // Water Features
    ocean: '#add3f0',
    mainWaterways: '#78b6e4',

    // Roads
    interstates: '#cd292c',
    highways: '#cd292c',
    mainRoads: '#cd292c',
    otherRoads: '#d3d3d3',

    // Background/Land
    background: '#fffef0',
    backgroundAlt: '#ffffff',

    // Land Use
    golfCourses: '#b3ddc0',
    parks: '#b3ddc0',
    airports: '#b3ddc0',

    // Cities/Places
    city1: '#fffcd5',
    city2: '#ffffff',
    city3: '#4f4f4f',

    // Boundaries
    zipCodes: '#5da9dd',
    countyLines: '#4a4a4a'
};

/**
 * Apply Dolph Map Company styling to the base map — single-pass optimization
 * @param {mapboxgl.Map} map - The Mapbox map instance
 */
function applyDolphStyle(map) {
    if (!map.isStyleLoaded()) {
        map.once('style.load', function() { applyDolphStyle(map); });
        return;
    }

    try {
        const layers = map.getStyle().layers;
        const C = DOLPH_COLORS;

        // Named layers — direct property sets (no loop needed)
        if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', C.ocean);
        if (map.getLayer('waterway')) map.setPaintProperty('waterway', 'line-color', C.mainWaterways);
        if (map.getLayer('waterway-label')) {
            map.setPaintProperty('waterway-label', 'text-color', C.waterwayTitles);
            map.setLayoutProperty('waterway-label', 'text-transform', 'uppercase');
        }
        if (map.getLayer('poi-label')) {
            map.setFilter('poi-label', [
                '!in', 'class',
                'commercial_services', 'food_and_drink',
                'food_and_drink_stores', 'lodging', 'store_like'
            ]);
        }

        // Single pass through all layers — categorize and style each once
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            const id = layer.id;
            const type = layer.type;

            try {
                // Background / Land
                if (id.includes('background') || id === 'land') {
                    if (type === 'background') {
                        map.setPaintProperty(id, 'background-color', C.background);
                    } else if (type === 'fill') {
                        map.setPaintProperty(id, 'fill-color', C.background);
                    }
                    continue;
                }

                // Fill layers — parks, golf, airports
                if (type === 'fill') {
                    if (id.includes('park') || id.includes('pitch')) {
                        map.setPaintProperty(id, 'fill-color', C.parks);
                    } else if (id.includes('golf')) {
                        map.setPaintProperty(id, 'fill-color', C.golfCourses);
                    } else if (id.includes('airport') || id.includes('aeroway')) {
                        map.setPaintProperty(id, 'fill-color', C.airports);
                    }
                    continue;
                }

                // Line layers — roads + boundaries
                if (type === 'line') {
                    if (id.includes('admin') && id.includes('2')) {
                        map.setPaintProperty(id, 'line-color', C.countyLines);
                    } else if (id.includes('motorway') || id.includes('trunk')) {
                        map.setPaintProperty(id, 'line-color', C.interstates);
                    } else if (id.includes('primary')) {
                        map.setPaintProperty(id, 'line-color', C.mainRoads);
                    } else if (id.includes('secondary') || id.includes('tertiary') || id.includes('street')) {
                        map.setPaintProperty(id, 'line-color', C.otherRoads);
                    }
                    continue;
                }

                // Symbol layers — labels
                if (type === 'symbol') {
                    const isPlace = id.includes('place') || id.includes('settlement') ||
                                    id.includes('city') || id.includes('town') || id.includes('village');
                    if (isPlace) {
                        map.setPaintProperty(id, 'text-color', C.cityTitles);
                        map.setLayoutProperty(id, 'text-transform', 'uppercase');
                        map.setLayoutProperty(id, 'text-font', ['DIN Pro Bold', 'Arial Unicode MS Bold']);
                    } else if (id.includes('road') && id.includes('label')) {
                        map.setPaintProperty(id, 'text-color', C.roadTitles);
                        map.setLayoutProperty(id, 'text-transform', 'uppercase');
                    } else if (!id.includes('waterway')) {
                        map.setLayoutProperty(id, 'text-transform', 'uppercase');
                    }
                }
            } catch (e) { /* skip unsupported layers */ }
        }
    } catch (error) {
        console.error('Error applying Dolph styling:', error);
    }
}

/**
 * Initialize the map
 */
let map;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof mapboxgl === 'undefined') {
        console.error('Mapbox GL JS not loaded');
        return;
    }

    mapboxgl.accessToken = CONFIG.mapbox.accessToken;

    map = new mapboxgl.Map({
        container: 'map',
        style: CONFIG.mapbox.style,
        center: CONFIG.mapbox.center,
        zoom: CONFIG.mapbox.zoom,
        minZoom: CONFIG.mapbox.minZoom,
        maxZoom: CONFIG.mapbox.maxZoom,
        maxBounds: CONFIG.mapbox.maxBounds
    });

    // Controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Dolph Map Company logo — bottom-left
    const dolphControl = {
        onAdd: function() {
            const container = document.createElement('div');
            container.className = 'mapboxgl-ctrl dolph-map-logo';
            const link = document.createElement('a');
            link.href = 'https://www.dolphmap.com';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.title = 'Dolph Map Company';
            const img = document.createElement('img');
            img.alt = 'Dolph Map Company';
            img.loading = 'lazy';
            // Use WebP with JPG fallback
            const testWebP = document.createElement('canvas');
            img.src = (testWebP.toDataURL && testWebP.toDataURL('image/webp').indexOf('data:image/webp') === 0)
                ? 'assets/logos/dolph-logo.webp'
                : 'assets/logos/dolph-logo.jpg';
            link.appendChild(img);
            container.appendChild(link);
            return container;
        },
        onRemove: function() {}
    };
    map.addControl(dolphControl, 'bottom-left');

    map.on('load', function() {
        applyDolphStyle(map);
        document.dispatchEvent(new CustomEvent('mapReady', { detail: { map: map } }));
    });
});

/**
 * Get the map instance (for use by other modules)
 */
function getMap() {
    return map;
}
