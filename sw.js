const scope = location.pathname.split("/").slice(0, -1).join("/") + "/";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
async function updateCache(request) {
  // Try opening the cache
  const cache = await caches.open('pythonWebApp');

  // Try fetching from the network
  const network = fetch(request).then((response) => {
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

    const sharedArrayBufferResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
    // Clone the response as it can only be consumed once
    const responseClone = sharedArrayBufferResponse.clone();

    // Respond and add the network response to the cache
    cache.put(request, responseClone);
    return sharedArrayBufferResponse;
  }).catch(err => { });

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
const sabs = [];
const waits = [];
async function handlePonyfill(request, resource) {
  if (resource.startsWith("SharedArrayBuffer/")) {
    const size = resource.split("/")[1] | 0;
    sabs.push(new Int8Array(size));
    waits.push({});
    return new Response(sabs.length - 1);
  }
  if (resource.startsWith("Atomics.wait/")) {
    const [_, identifier, index, value, timeout] = resource.split("/");
    const json = await request.json();
    for (let i = 0; i < json.curr.length; i++) {
      if (json.curr[i] != json.prev[i]) {
        sabs[identifier][i] = json.curr[i];
      }
    }
    while (new Int32Array(sabs[identifier].buffer)[index] == value) {
      if (!(index in waits[identifier])) {
        waits[identifier][index] = {};
        waits[identifier][index].promise = new Promise(accept => { waits[identifier][index].accept = accept });
      }
      await waits[identifier][index].promise;
    }
    return new Response(JSON.stringify({ value: "ok", buffer: Array.from(sabs[identifier]) }));
  }
  if (resource.startsWith("Atomics.notify/")) {
    const [_, identifier, index, count] = resource.split("/");
    const json = await request.json();
    for (let i = 0; i < json.curr.length; i++) {
      if (json.curr[i] != json.prev[i]) {
        sabs[identifier][i] = json.curr[i];
      }
    }
    if (index in waits[identifier]) {
      const accept = waits[identifier][index].accept;
      delete waits[identifier][index];
      accept();
    }
    return new Response();
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.host == location.host) {
    const resource = url.pathname.split("ponyfill/");
    if (resource.length === 2) {
      event.respondWith(handlePonyfill(request, resource[1]));
      return;
    }
  }
  if (request.method !== "GET") {
    return;
  }
  if (url.host == location.host) {
    if (url.pathname.startsWith(location.pathname.split("/sw.js")[0])) {
      if (url.pathname.includes("skulpt/")) {
        // large skulpt library files.
        // Obtained by cloning the skulpt repository
        // Running `npm install` and `npm run dist` and copying the dist folder contents
        // Only used for turtle
        event.respondWith(cacheFirst(request));
        return;
      }
      // Local files are small and should be updated if possible
      event.respondWith(updateCache(request));
    } else {
      // This line is needed, otherwise iframe breaks
      event.respondWith(fetch(request));
    }
  } else if (url.host == "cdn.jsdelivr.net") {
    // large files from CDNs
    event.respondWith(cacheFirst(request));
  }
});
