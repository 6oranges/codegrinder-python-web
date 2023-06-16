// This would be a module but
// pyodide is not a module and
// you cannot mix modules and scripts in a worker
class AtomicQueue {
  #head = null;
  #tail = null;
  #queue = null;
  constructor(sab) {
    this.#head = new Int32Array(sab, 0, 1);
    this.#tail = new Int32Array(sab, 4, 1);
    this.#queue = new Int8Array(sab, 8);
  }
  enqueueMultiple(bytes = new Int8Array()) {
    while (true) {
      const currentTail = Atomics.load(this.#tail, 0);
      const nextTail = (currentTail + bytes.length) % this.#queue.length;
      if (nextTail !== Atomics.load(this.#head, 0)) {
        Atomics.store(this.#tail, 0, nextTail);
        for (let byte = 0; byte < bytes.length; byte++) {
          this.#queue[currentTail + byte] = bytes[byte];
        }
        Atomics.notify(this.#head, 0, 1);
        return;
      }
      Atomics.wait(this.#tail, 0, currentTail);
    }
  }
  dequeueAll() {
    while (true) {
      const currentHead = Atomics.load(this.#head, 0);
      const currentTail = Atomics.load(this.#tail, 0);
      if (currentHead !== currentTail) {
        const items = [];
        let pos = currentHead;
        while (pos !== currentTail) {
          items.push(this.#queue[pos]);
          pos += 1;
          if (pos >= this.#queue.length) {
            pos = 0;
          }
        }
        Atomics.store(this.#head, 0, currentTail);
        Atomics.notify(this.#tail, 0, 1);
        return items;
      }
      Atomics.wait(this.#head, 0, currentHead);
    }
  }
  async asyncEnqueueMultiple(bytes = new Int8Array()) {
    while (true) {
      const currentTail = Atomics.load(this.#tail, 0);
      const nextTail = (currentTail + bytes.length) % queue.length;
      if (nextTail !== Atomics.load(this.#head, 0)) {
        Atomics.store(this.#tail, 0, nextTail);
        for (let byte = 0; byte < bytes.length; byte++) {
          this.#queue[currentTail + byte] = bytes[byte];
        }
        Atomics.notify(this.#head, 0, 1);
        return;
      }
      await Atomics.waitAsync(this.#tail, 0, currentTail).value;
    }
  }
  async asyncDequeueAll() {
    while (true) {
      const currentHead = Atomics.load(this.#head, 0);
      const currentTail = Atomics.load(this.#tail, 0);
      if (currentHead !== currentTail) {
        const items = [];
        let pos = currentHead;
        while (pos !== currentTail) {
          items.push(this.#queue[pos]);
          pos += 1;
          if (pos >= this.#queue.length) {
            pos = 0;
          }
        }
        Atomics.store(this.#head, 0, currentTail);
        Atomics.notify(this.#tail, 0, 1);
        return items;
      }
      await Atomics.waitAsync(this.#head, 0, currentHead).value;
    }
  }
}