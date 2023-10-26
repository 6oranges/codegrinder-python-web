importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.2/full/pyodide.js", "iframeSharedArrayBufferWorkaround.js", "./atomicQueue.js");
(async () => {
  const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.2/full/"
  })
  // This interrupt buffer needs to be a multiple of 4
  const interrupt = new SharedArrayBuffer(4);
  pyodide.setInterruptBuffer(interrupt);
  // 4000 was chosen because it is around a RAM page in common systems
  // In case of other book keeping 96 bytes are left
  const stdin = new SharedArrayBuffer(4000);
  const stdout = new SharedArrayBuffer(4000);
  const stderr = new SharedArrayBuffer(4000);
  const toMainThread = new SharedArrayBuffer(4000);
  const stdinQueue = new AtomicQueue(stdin);
  const stdoutQueue = new AtomicQueue(stdout);
  const stderrQueue = new AtomicQueue(stderr);
  const toMainThreadQueue = new AtomicJSONQueue(toMainThread);
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
  pyodide.runPython(`
  import sys
  def invalidate_import_cache():
      # Get a copy of the current module dictionary
      module_dict = dict(sys.modules)
  
      # Iterate over the modules and remove them from sys.modules
      for module_name in module_dict:
          if module_name not in sys.modules:
              continue
  
          module = sys.modules[module_name]
          if hasattr(module, '__file__') and module.__file__ is not None and module.__file__.startswith("/home/pyodide/"):
              # Remove the module from sys.modules
              del sys.modules[module_name]
  def run_script(script_path):
      invalidate_import_cache()
      with open(script_path, 'r') as file:
          script_code = compile(file.read(), script_path, 'exec')
  
      # Save the original values
      original_argv = sys.argv.copy()
  
      # Modify the values
      sys.argv = [script_path]
  
      try:
          exec(script_code, globals())
      except SystemExit:
          pass
      finally:
          # Restore the original values
          sys.argv = original_argv
    `)
  globalThis.showImage = (b64img) => {
    toMainThreadQueue.enqueueMessageSync({ showImage: b64img });
  }
  await pyodide.loadPackage("micropip")
  await pyodide.runPython(`
import micropip
micropip.install(["cisc108"])
`)

  // Load a directory into the pyodide virtual filesystem (emscripten)
  // We are using our abstraction defined in directoryTree.js
  function writeDirectory(directory, path) {
    for (let name in directory.children) {
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
  function deleteRecursively(path, onlyChildren = false) {
    if (pyodide.FS.isDir(path)) {
      const files = pyodide.FS.readdir(path);
      files.forEach((file) => {
        const filePath = path + '/' + file;
        deleteRecursively(filePath);
      });
      if (!onlyChildren) pyodide.FS.rmdir(path);
    } else {
      if (!onlyChildren) pyodide.FS.unlink(path);
    }
  };
  const modules = new Set(["cisc108"]);
  addEventListener("message", (e) => {
    const data = e.data;
    if (data.loadModules) {
      const toLoad = [];
      for (let module of data.loadModules) {
        module = module.trim();
        if (module == "") {
          continue;
        }
        if (!modules.has(module)) {
          toLoad.push(module);
          modules.add(module);
        }
      }
      pyodide.runPython(`
      import micropip
      micropip.install(`+ JSON.stringify(toLoad) + `)
            `).then(() => {
        if (toLoad.includes("matplotlib")) {
          pyodide.runPython(`
import base64
import os

from io import BytesIO

os.environ['MPLBACKEND'] = 'AGG'

import matplotlib.pyplot
import js
def ensure_matplotlib_patch():
    _old_show = matplotlib.pyplot.show

    def show():
        buf = BytesIO()
        matplotlib.pyplot.savefig(buf, format='png')
        buf.seek(0)
        # encode to a base64 str
        img = base64.b64encode(buf.read()).decode('utf-8')
        js.showImage(img)
        matplotlib.pyplot.clf()

    matplotlib.pyplot.show = show
ensure_matplotlib_patch()`);
        }
      });

    }
    if (data.fileSystem) {
      deleteRecursively(".", true);
      writeDirectory(data.fileSystem.rootNode, "./");
    }
    if (data.run) {
      try {
        pyodide.runPython(data.run);
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
    stdin, stdinid: stdin.identifier,
    stdout, stdoutid: stdout.identifier,
    stderr, stderrid: stderr.identifier,
    toMainThread, toMainThreadid: toMainThread.identifier,
    interrupt,
  });
})()
