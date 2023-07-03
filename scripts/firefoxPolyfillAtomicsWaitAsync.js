if (!Atomics.waitAsync) {
    let availableWorkers = [];

    Atomics.waitAsync = (ia, index, value, timeout) => {
        if (typeof ia != "object" || !(ia instanceof Int32Array) || !(ia.buffer instanceof SharedArrayBuffer))
            throw new TypeError("Expected shared memory");
        index |=0;
        value |=0;
        timeout = timeout === undefined ? Infinity : +timeout;
        ia[index];
        if (Atomics.load(ia, index) != value) return { async: false, value: "not-equal" };
        if (timeout === 0) return { async: false, value: "timed-out" };
        return {async: true,
            value: new Promise(resolve => {
                let worker = availableWorkers.length > 0?availableWorkers.pop():new Worker("data:application/javascript," + encodeURIComponent(`onmessage = e => postMessage(Atomics.wait(...e.data))`));
                worker.onmessage = e => {
                    availableWorkers.push(worker);
                    resolve(e.data);
                }
                worker.postMessage([ia, index, value, timeout]);
            })
        }
    }
}