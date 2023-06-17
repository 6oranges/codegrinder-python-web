importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js", "./atomicQueue.js");
(async () => {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.2/full/"
  })
  // This interrupt buffer needs to be a multiple of 4
  const interrupt = new SharedArrayBuffer(4);
  pyodide.setInterruptBuffer(interrupt);
  // 4000 was chosen because it is close to a multiple of 2
  // In case of other book keeping 96 bytes are left
  const stdin = new SharedArrayBuffer(4000);
  const stdout = new SharedArrayBuffer(4000);
  const stderr = new SharedArrayBuffer(4000);
  const dom = new SharedArrayBuffer(4000);
  const stdinQueue = new AtomicQueue(stdin);
  const stdoutQueue = new AtomicQueue(stdout);
  const stderrQueue = new AtomicQueue(stderr);
  pyodide.setStdin({
    stdin: () => {
      return new Int8Array(stdinQueue.dequeueAllSync());
    }
  })
  pyodide.setStdout({
    raw: (byte) => {
      stdoutQueue.enqueueMultipleSync([byte]);
    }
  })
  pyodide.setStderr({
    raw: (byte) => {
      stderrQueue.enqueueMultipleSync([byte]);
    }
  })
  // Dom is WIP
  const domQueue = new AtomicQueue(dom);
  const handler = {
    get: function (target, property) {
      console.log(`Accessed property: ${property}`);
      return {};
    },
    set: function (target, property, value) {
      console.log(`Set property: ${property} = ${value}`);
    },
    apply: function (target, thisArg, argumentsList) {
      throw new Error("cannot call document");
    },
    construct: function (target, argumentsList, newTarget) {
      throw new Error("cannot construct document");
    }
  };
  const proxy = new Proxy({}, handler);
  globalThis.document = proxy;

  function writeDirectory(directory, path) {
    for (let name of Object.keys(directory.children)) {
      let node = directory.children[name];
      // If is directory
      if (node.children) {
        writeDirectory(node, path + name + "/")
      } else {
        pyodide.FS.createPath('.', path, true, true);
        pyodide.FS.writeFile(path + name, node.content);
      }
    }
  }
  addEventListener("message", (e) => {
    const data = e.data;
    if (data.fileSystem) {
      writeDirectory(data.fileSystem.rootNode, "./");
    }
    if (data.run) {
      try {
        pyodide.runPython(pyodide.FS.readFile("." + data.run, { encoding: 'utf8' }));
      }
      catch (error) {
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(error.message);
        stderrQueue.enqueueChunkedMultipleSync(utf8Bytes);
      }
      postMessage({ finishedPython: true });
    }
  })
  postMessage({
    loaded: true,
    stdin,
    stdout,
    stderr,
    interrupt,
    dom,
  });
})()
