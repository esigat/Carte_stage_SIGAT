var map = new maplibregl.Map({
  container: "map",
  style:
    "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json", // Fond de carte
  customAttribution:
    '<a href="https://sites-formations.univ-rennes2.fr/mastersigat/"target="_blank">Master SIGAT</a>',
  center: [2.384119336279427, 46.6172973093053], // lat/long
  zoom: 5, // zoom
  pitch: 0, // Inclinaison
  bearing: 0, // Rotation
  minZoom: 3
});

//Choix fond de carte
var fonds = {
    "positron": "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
    "dark": "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
    "osm": "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"
};

document.getElementById('fond-carte').addEventListener('change', function() {
    map.setStyle(fonds[this.value]);
});


// Boutons de navigation
var nav = new maplibregl.NavigationControl();
map.addControl(nav, "top-left");

// Ajout Echelle cartographique
map.addControl(
  new maplibregl.ScaleControl({
    maxWidth: 60,
    unit: "metric"
  })
);


map.on('style.load', function(){

    //Contours communes
    map.addSource("ADMIN_EXPRESS", {
        type: "vector",
        url: "https://data.geopf.fr/tms/1.0.0/ADMIN_EXPRESS/metadata.json",
    });

    map.addLayer({
        id: "communes",
        type: "line",
        source: "ADMIN_EXPRESS",
        "source-layer": "commune",
        minzoom : 10,
        layout: { visibility: "visible" },
        paint: {
        "line-color": "#a3a3a3",
        
        "line-width": {
            stops: [
            [8, 0.1],
            [12, 0.2]
            ]
        }
        }
    });

    map.addLayer({
    id: "noms-communes",
    type: "symbol",
    source: "ADMIN_EXPRESS",
    "source-layer": "chef_lieu_d_arrondissement",
    minzoom: 8,
     layout: {
        "text-field": ["get", "nom_du_chef_lieu"],
        "text-size": 12,
        "text-anchor": "center"
    },
    paint: {
        "text-color": "#333333",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1
    }
});
    
    // Ajouter les ponctuelles des stages

    map.addSource("Stages_VF", {
      type:"geojson",
      data:"https://raw.githubusercontent.com/esigat/Carte_stage_SIGAT/refs/heads/main/Stages_VF.geojson",
      cluster: true,          // active le clustering
      clusterMaxZoom: 14,     // arrête de grouper à partir du zoom 14
      clusterRadius: 50       // rayon de regroupement en pixels
    });
    

    // Cercle pour les clusters
    map.addLayer({
      id: "cluster",
      type: "circle",
      source: "Stages_VF",
      filter: ["has", "point_count"],
      paint: {
          "circle-radius": 20,
          "circle-color": "#000000"
      }
    });

    // Nombre de points dans le cluster
    map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "Stages_VF",
        filter: ["has", "point_count"],
        layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
        },
        paint: {
            "text-color": "#ffffff"
        }
    });

    // Points individuels
    map.addLayer({
        id: "points_stages",
        type: "circle",
        source: "Stages_VF",
        filter: ["!", ["has", "point_count"]],
        paint: {
            "circle-radius": 6,
            "circle-color": "#000000",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff"
        }
    });

});



// Action de survol et de click sur les points

var popup = new maplibregl.Popup({
  className: "popupstage",
  closeButton: false,
  closeOnClick: false
});

map.on("mousemove", function (e) {
  var features = map.queryRenderedFeatures(e.point, { layers: ["points_stages"] });

  // Change le curseur
  map.getCanvas().style.cursor = features.length ? "pointer" : "";
  if (!features.length) {
    popup.remove();
    return;
  }
  var feature = features[0];
  popup
    .setLngLat(feature.geometry.coordinates)
    .setHTML(
      "<b>" + feature.properties.Prenom + " " + feature.properties.Nom + "</b>" + 
      "<br>" + "<i>" + feature.properties.Institution_accueil +  "</i>" + "<br>" +
      feature.properties.Lieu_stage + "—" + feature.properties.Annee + "<br>" + "<small>" +
      feature.properties.Titre_Memoire + "</small>"
    )
    .addTo(map);
});

map.on('load', function() {
    fetch('https://raw.githubusercontent.com/esigat/Carte_stage_SIGAT/refs/heads/main/Stages_VF.geojson')
        .then(r => r.json())
        .then(data => {
            afficherListe(data.features);
        });
});

//Création de la listes des stage dans le panneau

function afficherListe(features) {
    features = features.filter(f => f.geometry && f.geometry.coordinates);
    features.sort((b, a) => a.properties.Annee.localeCompare(b.properties.Annee));

    var liste = features.map(f =>
        `<li>
            <button class = stages-bip
            data-lng="${f.geometry.coordinates[0]}" 
            data-lat="${f.geometry.coordinates[1]}">
            <b>${f.properties.Prenom} ${f.properties.Nom}</b><br>
            <i>${f.properties["Institution_accueil"]}</i><br>
            ${f.properties["Lieu_stage"]} — ${f.properties.Annee}<br>
            <small>${f.properties["Titre_Memoire"]}</small></button>
        </li>`
    ).join('');

    document.getElementById('liste_stages').innerHTML = liste;
    
    //Boutons pour zoomer sur les stages
    document.querySelectorAll('.stages-bip').forEach(btn => {
    btn.addEventListener('click', function() {
        var lng = parseFloat(this.dataset.lng);
        var lat = parseFloat(this.dataset.lat);
        map.easeTo({ center: [lng, lat], zoom: 10, duration: 1500 });
        document.getElementById('retour').style.display = 'block' // affiche
    });
    document.getElementById('retour').style.display = 'none'; //cache
});
}


// Filtre stages présent dans le cluster clické

map.on('click', function(e) {
    var clusterfeatures = map.queryRenderedFeatures(e.point, { layers: ['cluster'] });
    var pointsfeatures = map.queryRenderedFeatures(e.point, { layers: ['points_stages'] });

    if (clusterfeatures.length > 0) {
        var clusterId = clusterfeatures[0].properties.cluster_id;
        map.getSource('Stages_VF').getClusterLeaves(clusterId, 100, 0)
            .then(leaves => {
                afficherListe(leaves);
                document.getElementById('retour').style.display = 'block'; // affiche
            });
    } else if (pointsfeatures.length > 0) {
        afficherListe(pointsfeatures);
        document.getElementById('retour').style.display = 'block'; // affiche
    } else {
        fetch('https://raw.githubusercontent.com/esigat/Carte_stage_SIGAT/refs/heads/main/Stages_VF.geojson')
            .then(r => r.json())
            .then(data => afficherListe(data.features));
        document.getElementById('retour').style.display = 'none'; // cache
    }

    if (clusterfeatures.length > 0) {
        var clusterId = clusterfeatures[0].properties.cluster_id;
        var coords = clusterfeatures[0].geometry.coordinates;
        
        map.getSource('Stages_VF').getClusterLeaves(clusterId, 100, 0)
            .then(leaves => {
                afficherListe(leaves);
                document.getElementById('retour').style.display = 'block';
                map.easeTo({
                    center: coords,
                    zoom: 10,
                    duration: 1200
                });
            });

    }     else if (pointsfeatures.length > 0) {
    afficherListe(pointsfeatures);
    document.getElementById('retour').style.display = 'block';
    map.easeTo({
        center: pointsfeatures[0].geometry.coordinates,
        zoom: 8,
        duration: 1200
        });
    document.getElementById('retour').style.display = 'block'; // cache
    }
});



// Réglage de la flèche retour

document.getElementById('retour').addEventListener('click', function() {
    fetch('https://raw.githubusercontent.com/esigat/Carte_stage_SIGAT/refs/heads/main/Stages_VF.geojson')
        .then(r => r.json())
        .then(data => afficherListe(data.features));
    document.getElementById('retour').style.display = 'none'; // cache

    map.easeTo({
        center: [2.384119336279427, 46.6172973093053],
        zoom: 5,
        duration: 1200
        });
});


// Filtre par année
fetch('https://raw.githubusercontent.com/esigat/Carte_stage_SIGAT/refs/heads/main/Stages_VF.geojson')
    .then(r => r.json())
    .then(data => {
        var annees = [...new Set(data.features.map(f => f.properties.Annee))].sort().reverse();
        
        var options = annees.map(a => 
            `<option value="${a}">${a}</option>`
        ).join('');
        
        document.getElementById('filtre-annee').innerHTML += options;

        document.getElementById('filtre-annee').addEventListener('change', function() {
            var annee = this.value;
            if (annee === 'toutes') {
                afficherListe(data.features);
            } else {
                var filtres = data.features.filter(f => f.properties.Annee === annee);
                afficherListe(filtres);
            }
        });
    });


document.addEventListener('DOMContentLoaded', function() {
    var destinations = {
        "europe":    {center : [2.38411, 46.6172],    zoom: 4 },
        "am-sud":    { center: [-53.1258, 3.9339],    zoom: 4 },
        "afrique":     { center: [-1.0232, 7.9465],     zoom: 4 },
        "oceanie": { center: [159.8222, -27.9309],  zoom: 4 }
    };

    document.querySelectorAll('.zoom-stage').forEach(btn => {
        btn.addEventListener('click', function() {
            var lieu = this.dataset.lieu;
            map.easeTo({
                center: destinations[lieu].center,
                zoom: destinations[lieu].zoom,
                duration: 1500
            });
        });
    });
});