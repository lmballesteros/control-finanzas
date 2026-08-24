/* Service Worker — Control financiero
   Objetivo: que la app (interfaz, cálculos, datos locales) funcione sin conexión.
   Las funciones que requieren internet (escanear recibos con IA) NO se cachean:
   si no hay red, esas llamadas simplemente fallarán con su propio manejo de error,
   pero el resto de la app sigue funcionando con normalidad. */

var CACHE_NAME = "control-financiero-v18";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    })
    /* nota: ya NO llamamos self.skipWaiting() aquí — dejamos que el nuevo SW
       espere en estado "waiting" hasta que la persona confirme la actualización
       desde la app (botón "Actualizar"), evitando que pierda datos en pantalla
       a mitad de una acción por una activación forzada e inesperada. */
  );
});

self.addEventListener("message", function(event){
  if(event.data && event.data.type === "SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  var url = new URL(req.url);

  // Nunca interceptar llamadas a la API de Anthropic (necesitan red real, no cache).
  if(url.hostname.indexOf("anthropic.com") !== -1){
    return;
  }

  // Solo manejar peticiones GET del mismo origen (el app shell).
  if(req.method !== "GET" || url.origin !== self.location.origin){
    return;
  }

  event.respondWith(
    caches.match(req).then(function(cached){
      var fetchPromise = fetch(req).then(function(networkRes){
        if(networkRes && networkRes.status === 200){
          var clone = networkRes.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, clone); });
        }
        return networkRes;
      }).catch(function(){
        return cached;
      });
      // Estrategia: cache primero para velocidad e offline, refresca en segundo plano.
      return cached || fetchPromise;
    })
  );
});
