/**
 * CONFIG.JS - Collier County Precinct Map Configuration
 *
 * All map settings in one place. Update these values to customize the map.
 */
const CONFIG = {
    mapbox: {
        accessToken: 'pk.eyJ1IjoicnlhbmRvbHBoanIiLCJhIjoiY21nenN1bGR1MDkwcWFtcHV3MTl6bWRodSJ9.VnbaNeUpr7ixd2knIEdEhg',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-81.36, 26.38],
        zoom: 8.6,
        minZoom: 5,
        maxZoom: 16,
        // Bounds: SW corner, NE corner — tight around Collier County
        maxBounds: [[-82.2, 25.5], [-80.8, 27.0]]
    },
    data: {
        geojsonPath: 'data/precincts.geojson'
    },
    precinctColor: '#1a5276'
};
