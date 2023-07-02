# Architecture
## Javascript Modules
Functionality is seperated into javascript modules. A javascript module doesn't leak it's namespace.
When functionality is shared then it is exported from a module and imported in another.

Exceptions that are loaded globally and not in modules:
* 3rd party code (`ace.js`, `pyodide.js`, `markdown-it.js`)
* `atomicQueue.js` (it runs in a worker with `pyodide.js`; workers cannot mix modules and scripts)

To limit the global code problems their accesses are listed here
* `ace.js` is accessed only by `editorTabs.js` under the name `window.ace`
* `markdown-it.js` is accessed only by `app.js` under the name `window.markdownit`
* `pyodide.js` is accessed only by `pythonWorker.js` under the name `loadPyodide`
* `atomicQueue.js` is accessed by `pythonHandler.js` and `pythonWorker.js` under the name `AtomicQueue`
## Purpose of files
Local Files:
* `app.js` is glue code for the whole application. It also controls how persistant data is stored.
* `atomicQueue.js` provides a means to communicate with a worker asynchronously from the main thread and synchronously from the worker.
* `codeGrinder.js` controls all api requests to Codegrinder. It also provides a UI component.
* `directoryTree.js` defines a simple filesystem that we use. It also provides a UI component.
* `editorTabs.js` provides the tabs for the editor.
* `pythonHandler.js` Runs on the main thread and handles the communication with the python worker.
* `pythonWorker.js` Runs on its own thread. Runs python code.
* `resizeInstructions.js` and `resizeTerminal.js` manage the resize handles for the instructions and terminal respectfully.
* `sw.js` is a service worker that caches requests to make them faster later. Also enables offline use.

3rd Party Files (All from cdn.jsdelivr.net):
* `ace.js` Provides the editor
* `pyodide.js` Uses emscripten and WebAssembly to run python in the browser.
* `markdown-it.js` Used to display markdown. (currently Codegrinder provides compiled markdown)
## Limited spread of objects
To try to make code readable locally objects should not be referenced in a module that doesn't import them directly.
Currently the only exception is the `directoryTree.js` `FileSystem` object which is accessed in `pythonWorker.js`.
## Web APIs
We are using a lot of Javascript/Web APIs.
* Javascript Classes which have private data members/methods designated by a leading #
* WebAssembly which allows python to be run in the browser.
* SharedArrayBuffer & Atomics which makes `atomicQueue.js` work
* Async Await. This is used extensively. An async function returns a Promise. To get the result you must await the Promise.
* Default arguments and Destructuring assignment to enable keyword arguments.
* Web workers. Allows us to use multiple threads.
* Optional Chaining. Allows a chain of accesses to short circuit on a null. foo?.bar returns null if foo is null.
* localStorage. Enables persistant storage.
* prompt and confirm. These are used for convenience of coding. A user could avoid most of them except codegrinder login.
# Hosting
Because we are using SharedArrayBuffer the document must be sent with the following headers
shown as they would be in an nginx configuration file.
```
location / {
    # set response headers
    add_header 'Cross-Origin-Embedder-Policy' 'require-corp';
    add_header 'Cross-Origin-Opener-Policy' 'same-origin';
}
```
Currently Codegrinder is not directly accessable because of CORS. A workaround is in place
in `codeGrinder.js` that requres the server to provide a trampoline function. In Node.js it looks like:
```
app.post("/trampoline", async function (req, res) {
    try {
        if (typeof req.body.url !== "string"){
            res.status(400);
            return;
        }
        let options = {headers:{}}
        if (["GET","POST"].includes(req.body.options?.method)){
            options.method=req.body.options?.method;
        }
        if (typeof req.body.options?.body === "string"){
            options.body=req.body.options.body;
        }
        if (typeof req.body.options?.headers?.Cookie === "string"){
            options.headers.Cookie=req.body.options.headers.Cookie;
        }
        const response = await fetch(req.body.url, options);
        const text = await response.text();
        res.status(response.status).send(text);
        return;
    } catch (error) {
        res.status(400);
        return;
    }
})
```
Besides the above everything can be statically hosted.
# Formatting
The formatting is based on the default vscode right click `Format Document` command.