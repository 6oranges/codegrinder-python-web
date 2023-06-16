const scope = location.pathname.split("/").slice(0, -1).join("/") + "/";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
async function updateCache(request, accept) {
  // Try opening the cache
  const cache = await caches.open('pythonWebApp');

  // Try fetching from the network
  fetch(request).then((response) => {
    // Clone the response as it can only be consumed once
    const responseClone = response.clone();

    // Respond and add the network response to the cache
    cache.put(request, responseClone);
    accept(response);
  });

  // At the same time try the cache
  const response = await cache.match(request);
  if (response) {
    accept(response);
  }
}
async function cacheFirst(request, accept) {
  // Try opening the cache
  const cache = await caches.open('pythonWebApp');
  const response = await cache.match(request);
  if (response) {
    accept(response);
  } else {
    if (request.mode !== "cors") {
      // Modify the request's headers to include CORS headers
      const modifiedHeaders = new Headers(request.headers);
      modifiedHeaders.append('Origin', self.origin);

      // Create a new request with the modified headers
      request = new Request(request.url, {
        method: request.method,
        headers: modifiedHeaders,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow'
      });
    }
    // Try fetching from the network
    fetch(request).then((response) => {
      // Clone the response as it can only be consumed once
      const responseClone = response.clone();

      // Respond and add the network response to the cache
      cache.put(request, responseClone);
      accept(response);
    });
  }
}

self.addEventListener('fetch', (event) => {
  event.respondWith(new Promise(async (accept) => {
    const request = event.request;
    const url = new URL(request.url);
    if (url.host == location.host) {
      // Local files are small and should be updated if possible
      updateCache(request, accept);
    } else {
      // Non local resources are large files from CDNs
      cacheFirst(request, accept);
    }
  }))
});
