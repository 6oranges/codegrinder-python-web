importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js", "./atomicQueue.js");
(async () => {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.2/full/"
  })
  const interrupt = new SharedArrayBuffer(4);
  pyodide.setInterruptBuffer(interrupt);
  const stdin = new SharedArrayBuffer(1024);
  const stdout = new SharedArrayBuffer(1024);
  const stderr = new SharedArrayBuffer(1024);
  const stdinQueue = new AtomicQueue(stdin);
  const stdoutQueue = new AtomicQueue(stdout);
  const stderrQueue = new AtomicQueue(stderr);
  pyodide.setStdin({
    stdin: () => {
      return new Int8Array(stdinQueue.dequeueAll());
    }
  })
  pyodide.setStdout({
    raw: (byte) => {
      stdoutQueue.enqueueMultiple([byte]);
    }
  })
  pyodide.setStderr({
    raw: (byte) => {
      stderrQueue.enqueueMultiple([byte]);
    }
  })
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
        stderrQueue.enqueueMultiple(utf8Bytes);
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
  });
})()
