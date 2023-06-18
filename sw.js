const scope = location.pathname.split("/").slice(0, -1).join("/") + "/";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
async function updateCache(request) {
  // Try opening the cache
  const cache = await caches.open('pythonWebApp');

  // Try fetching from the network
  const network = fetch(request).then((response) => {
    // Clone the response as it can only be consumed once
    const responseClone = response.clone();

    // Respond and add the network response to the cache
    cache.put(request, responseClone);
    return response;
  }).catch(err=>{});

  const response = await cache.match(request);
  if (response) {
    return response;
  }
  return await network;
}
async function cacheFirst(request) {
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
  // Try opening the cache
  const cache = await caches.open('pythonWebApp');
  const response = await cache.match(request);
  if (response) {
    return response;
  }
  // Try fetching from the network
  return await fetch(request).then((response) => {
    // Clone the response as it can only be consumed once
    const responseClone = response.clone();

    // Respond and add the network response to the cache
    cache.put(request, responseClone);
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method!=="GET"){
    return;
  }
  const url = new URL(request.url);
  if (url.host == location.host) {
    // Local files are small and should be updated if possible
    event.respondWith(updateCache(request));
  } else if (url.host == "cdn.jsdelivr.net"){
    // large files from CDNs
    event.respondWith(cacheFirst(request));
  }
});
