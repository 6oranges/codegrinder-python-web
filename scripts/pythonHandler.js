class PythonWorker {
  #loaded;
  #pythonFinished;
  #destroy;
  #worker;
  #stdin;
  #stdout;
  #stderr;
  #interrupt;
  constructor(stdoutCallback = (str) => { }, stderrCallback = (str) => { }) {
    this.stdoutCallback = stdoutCallback;
    this.stderrCallback = stderrCallback;
    this.#worker = new Worker(new URL('./pythonWorker.js', import.meta.url));
    this.runningPython = false;
    this.destroyed = new Promise((accept) => {
      this.#destroy = accept;
    })
    this.destroyed.then(() => {
      this.#worker.terminate();
    })
    this.ready = new Promise((accept) => {
      this.#loaded = accept;
    });
    this.#worker.addEventListener("message", (e) => {
      if (e.data.loaded) {
        this.#interrupt = e.data.interrupt;
        this.#stdin = new AtomicQueue(e.data.stdin);
        this.#stdout = new AtomicQueue(e.data.stdout);
        this.#stderr = new AtomicQueue(e.data.stderr);
        this.#loaded();
      }
      if (e.data.finishedPython) {
        this.#pythonFinished();
      }
    })
    this.ready.then(() => {
      this.#registerStream(this.#stdout, (str) => {
        this.stdoutCallback(str);
      })
      this.#registerStream(this.#stderr, (str) => {
        this.stderrCallback(str);
      })
    })
  }
  destroy() {
    this.#destroy();
  }
  async runPython(fileSystem, path) {
    await this.ready;
    if (this.runningPython) {
      throw new Error("Already running python on this worker");
    }
    this.runningPython = true;
    const execution = new Promise((resolve) => { this.#pythonFinished = resolve })
    this.#worker.postMessage({ fileSystem, run: path });
    await Promise.race([execution, this.destroyed]);
    this.runningPython = false;
  }
  async writeStdin(str) {
    await this.ready;
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(str);
    this.#stdin.enqueueMultipleAsync(utf8Bytes);
  }
  async #registerStream(stream, callback) {
    const decoder = new TextDecoder('utf-8');
    while (true) {
      const bytes = await Promise.race([stream.asyncDequeueAll(), this.destroyed]);
      if (!bytes) {
        return;
      }
      const string = decoder.decode(new Int8Array(bytes), { stream: true });
      if (string) {
        callback(string);
      }
      // don't block page
      await new Promise((accept) => setTimeout(() => accept(), 0));
    }
  }
}
class PythonRunner {
  #worker;
  constructor(stdoutCallback = (str) => { }, stderrCallback = (str) => { }) {
    this.stdoutCallback = stdoutCallback;
    this.stderrCallback = stderrCallback;
    this.#worker = new PythonWorker(this.stdoutCallback, this.stderrCallback);
    this.ready = this.#worker.ready;
  }
  stopPython() {
    this.#worker.destroy();
    this.#worker = new PythonWorker(this.stdoutCallback, this.stderrCallback);
    this.ready = this.#worker.ready;
  }
  async runPython(fileSystem, path) {
    if (this.#worker.runningPython) {
      this.stopPython();
    }
    await this.#worker.runPython(fileSystem, path);
  }
  setStdoutCallback(callback) {
    this.stdoutCallback = callback;
    this.#worker.stdoutCallback = callback;
  }
  setStderrCallback(callback) {
    this.stderrCallback = callback;
    this.#worker.stderrCallback = callback;
  }
}
export { PythonRunner };