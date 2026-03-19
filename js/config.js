/**
 * CONFIG.JS - Collier County Precinct Map Configuration
 *
 * All map settings in one place. Update these values to customize the map.
 */
const CONFIG = {
    mapbox: {
        accessToken: 'pk.eyJ1IjoicnlhbmRvbHBoanIiLCJhIjoiY21nenN1bGR1MDkwcWFtcHV3MTl6bWRodSJ9.VnbaNeUpr7ixd2knIEdEhg',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-81.68, 26.16],
        zoom: 9.5,
        minZoom: 8,
        maxZoom: 16,
        // Bounds: SW corner, NE corner — padded ~0.3° around precinct extents
        maxBounds: [[-82.2, 25.5], [-80.5, 26.9]]
    },
    data: {
        geojsonPath: 'data/precincts.geojson'
    },
    precinctColor: '#1a5276'
};
