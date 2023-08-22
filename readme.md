# Architecture
## Javascript Modules
Functionality is seperated into javascript modules. A javascript module doesn't leak it's namespace.
When functionality is shared then it is exported from a module and imported in another.

Exceptions that are loaded globally and not in modules:
* 3rd party code (`ace.js`, `pyodide.js`, `markdown-it.js`, `skulpt.js`)
* `atomicQueue.js` (it runs in a worker with `pyodide.js`; workers cannot mix modules and scripts)

To limit the global code problems their accesses are listed here
* `ace.js` is accessed only by `editorTabs.js` under the name `window.ace`
* `markdown-it.js` is accessed only by `app.js` under the name `window.markdownit`
* `pyodide.js` is accessed only by `pythonWorker.js` under the name `loadPyodide`
* `atomicQueue.js` is accessed by `pythonHandler.js` and `pythonWorker.js` under the name `AtomicQueue`
* `skulpt.js` is accessed only by app.js. Ideally we would use pyodide always but turtle isn't in pyodide.
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
* `prompt.js` An asynchronous prompt api for getting input from the user. Used to login
* `iframeSharedArrayBufferWorkaround.js` Provides a ponyfill for SharedArrayBuffer and related Atomics for use in iframes.
* `firefoxPolyfillAtomicWaitAsync.js` Provides a polyfill for Atomic.waitAsync in firefox.
3rd Party Files from cdn.jsdelivr.net:
* `ace.js` Provides the editor
* `pyodide.js` Uses emscripten and WebAssembly to run python in the browser.
* `markdown-it.js` Used to display markdown. (currently Codegrinder provides compiled markdown)
3rd Party Files local:
* `skulpt.js` It isn't on a cdn as it was built from source. Again would be better if we only had 1 python interpreter (pyodide), but we need turtle.
## Limited spread of objects
To try to make code readable locally objects should not be referenced in a module that doesn't import them directly.
Exceptions:
* `FileSystem` object from `directoryTree.js` is accessed in `pythonWorker.js`.
* `app.js` knows too much about `pythonWorker.js`. It needs to know about images from matplotlib and has hardcoded the function to run a python file.
## Python libraries
Matplotlib takes a while to load, up to 10 seconds. The python interpreter loads much faster and sends the ready signal to the main thread within a few seconds. While matplotlib is loading running matplotlib will cause an error which will prevent it from finishing loading.

Turtle is ran using a different interpreter than all the other python. As such it suffers from bad error messages and only works on single files on the main thread which cannot be interrupted.
## Web APIs
We are using a lot of Javascript/Web APIs.
* Javascript Classes which have private data members/methods designated by a leading #
* WebAssembly which allows python to be run in the browser.
* SharedArrayBuffer & Atomics which makes `atomicQueue.js` work
* Async Await. This is used extensively. An async function returns a Promise. To get the result you must await the Promise.
* Default arguments and Destructuring assignment to enable keyword arguments.
* Web workers. Allows us to use multiple threads.
* Optional Chaining. Allows a chain of accesses to short circuit on a null. foo?.bar returns null if foo is null.
* localStorage. Enables persistant storage. This should be considered for removal as well as prompt. With autologin we don't need to store anything or prompt.
* prompt and confirm. These are used for convenience of coding.
# Hosting
To enable SharedArrayBuffer server side use the following headers (shown as would be in nginx configuration file)
```
location / {
    # set response headers
    add_header 'Cross-Origin-Embedder-Policy' 'require-corp';
    add_header 'Cross-Origin-Opener-Policy' 'same-origin';
}
```
If not running on Codegrinder server then it is not directly accessable because of CORS. A workaround is in place
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
# Hacks (via service worker)
I designed this with SharedArrayBuffer in mind because it is the ideal method to convert a synchronous task in a worker into an asynchronous task on the main thread. Unfortunately iframes cannot use SharedArrayBuffer unless factors outside our control in the parent document are in place. This means that we must use a fishy method to communicate between the python thread and the main thread. That fishy method is using a service worker to emulate SharedArrayBuffer. iframeSharedArrayBuffer.js communicates with the service worker with XMLHTTPRequest, an ancient api that allows synchronous requests to be made. Using Synchronous XMLHTTPRequest on the worker thread can emulate Atomics.wait albiet slowly.

In a similar vein, the service worker is also used to forcibly send the SharedArrayBuffer headers so that the server doesn't have to. This is only relevent if not running in an iframe though.

The service worker is also used to get around another iframe problem. That is, an iframe cannot send cookies in requests for some reason. To solve this the service worker catches the request and refetches it, this indirection prevents the cookies from being removed. Cookies are needed to talk to codegrinder.

The service worker currently caches all assets on installation (or shortly afterward for libraries)which means that if the project is updated then students will not get a new version immediately. Rather the service worker has a version string which must be updated. After updating the version string students must first view the page, (open or reload) and then they must close their browser entirely and open it again for it to update. This is because of the above hack using synchronous requests to wait, browsers avoid closing service workers that are actively processing requests.
# Formatting
The formatting is based on the default vscode right click `Format Document` command.