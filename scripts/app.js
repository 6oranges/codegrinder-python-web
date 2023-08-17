import { Tabs } from './editorTabs.js';
import { FileSystem, FileSystemUI, extension } from './directoryTree.js';
import { PythonRunner } from './pythonHandler.js'
import { CodeGrinder, CodeGrinderUI } from './codeGrinder.js';
const output_terminal_label = document.getElementById("output_terminal")
const output_terminal = output_terminal_label.getElementsByTagName("pre")[0];
const input_terminal = output_terminal_label.getElementsByTagName("textarea")[0];
const filesButton = document.getElementById("files_button");
const filesList = document.getElementById("files_list");
const run = document.getElementById("run");
const newTab = document.getElementById("new_tab");
const saveCurrent = document.getElementById("save_current");
const saveAll = document.getElementById("save_all");
const mdElement = document.getElementById("instructions");
const navBar = document.getElementById("nav_bar");
const md = window.markdownit();
const fileSystem = new FileSystem();
const fileSystemUI = new FileSystemUI(fileSystem, document.getElementById("directory_tree"));
let mostRecentChange = new Date();
const tabs = new Tabs(document.getElementById("tabs"), (path, content) => {
    const fout = fileSystem.touch(path);
    fout.content = content;
    mostRecentChange = new Date();
    fileSystemUI.refreshUI();
});

const pythonRunner = new PythonRunner();
const urlParams = new URLSearchParams(window.location.search);

// Set up files dropdown
filesButton.addEventListener("click", () => {
    filesList.style.display = "block";
});
// Click away from dropdowns to close
document.addEventListener("click", event => {
    if (event.target !== filesButton) {
        filesList.style.display = "none";
    }
})

// Set up tabs
fileSystemUI.fileClick = (fileNode, path) => {
    filesList.style.display = "none";
    tabs.addSwitchTab(path, fileNode.content);
    if (extension(path) === "md") {
        mdElement.innerHTML = md.render(fileNode.content);
    } else if (extension(path) === "html") {
        console.warn("Running potentially untrusted html");
        mdElement.innerHTML = fileNode.content;
    }
};
newTab.addEventListener("click", () => {
    tabs.addNewTab();
})
saveCurrent.addEventListener("click", () => {
    tabs.saveCurrentTab();
})
saveAll.addEventListener("click", () => {
    tabs.saveAllTabs();
})

// Set up terminal
let previousSpan = document.createElement("span");
function writeTerminal(str, color) {
    if (previousSpan.style.color !== color) {
        const resetFocus = document.activeElement === input_terminal;
        previousSpan = document.createElement("span");
        previousSpan.style.color = color;
        output_terminal.appendChild(previousSpan);
        output_terminal.appendChild(input_terminal);
        if (resetFocus) {
            input_terminal.focus();
        }
    }
    setTimeout(() => {
        output_terminal_label.parentElement.scrollTop = output_terminal_label.parentElement.scrollHeight;
    }, 100);
    previousSpan.innerText += str;
}

// Set up python
let pythonRunning = false;
let serverRunning = false;
window.iframeSharedArrayBufferWorkaroundServiceWorkerLoss = function () {
    pythonRunner.stopPython();
}
let serverStdin;
run.disabled = true;
pythonRunner.ready.then(() => {
    run.disabled = false;
    run.innerText = "Run";
    writeTerminal(">> ", "orange");
});
input_terminal.addEventListener("keydown", event => {
    input_terminal.style.color = pythonRunning ? "grey" : "blue";
    if (event.key === "Enter") {
        let value = input_terminal.value.replace(/\n+$/, "") + "\n";
        input_terminal.value = "";
        input_terminal.focus();
        event.preventDefault();
        if (serverRunning) {
            serverStdin(value)
        }
        if (pythonRunning) {
            writeTerminal(value, "grey");
            pythonRunner.writeStdin(value);
        } else {
            writeTerminal(value, "blue");
            run.innerText = "Stop"
            pythonRunning = true;
            pythonRunner.runPython(fileSystem, value).then(async () => {
                await pythonRunner.ready;
                writeTerminal(">> ", "orange");
                pythonRunning = false;
                run.innerText = "Run";
                run.disabled = false;
            });
        }
    }
})
pythonRunner.setStdoutCallback(str => {
    writeTerminal(str, "black");
})
pythonRunner.setStderrCallback(str => {
    writeTerminal(str, "red");
});
function builtinRead(x) {
    if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
        throw "File not found: '" + x + "'";
    return Sk.builtinFiles["files"][x];
}
async function runSkulpt(code) {
    Sk.configure({ output: (text) => { writeTerminal(text, "black") }, read: builtinRead });
    (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtle';
    var myPromise = Sk.misceval.asyncToPromise(function () {
        return Sk.importMainWithBody("<stdin>", false, code, true);
    });
    myPromise.then(function (mod) {
    },
        function (err) {
            writeTerminal(err.toString(), "black");
        });
    await myPromise;
}
pythonRunner.setToMainThreadCallback(data => {
    const img = new Image();
    img.src = "data:image/png;base64," + data.showImage;
    document.getElementById("turtle").innerText = "";
    document.getElementById("turtle").appendChild(img);
});
async function runPython(path) {
    let content = "";
    try {
        content = fileSystem.touch(path).content;
    } catch {
        // If the above failed it is most likely because the path is invalid
        // In which case pyodide has a better error message
        // Pass invalid path on intentionally
    }
    if (content.includes("import turtle")) {
        await runSkulpt(content);
        return;
    }
    if (pythonRunning) {
        run.disabled = true;
        pythonRunning = false;
        pythonRunner.stopPython();
        run.innerText = "Stopping";
    } else {
        run.innerText = "Stop"
        pythonRunning = true;
        writeTerminal("Running " + path + "\n", "orange");
        await pythonRunner.runPython(fileSystem, `run_script(".${path}")`);
        await pythonRunner.ready;
        writeTerminal(">> ", "orange");
        pythonRunning = false;
        run.innerText = "Run";
        run.disabled = false;
    }
}
run.addEventListener("click", () => {
    runPython(tabs.tabs[tabs.currentTab].path);
})

function setupCodegrinder() {
    const codegrinderCookie = "codegrinderCookie";
    const codeGrinder = new CodeGrinder(window.localStorage.getItem(codegrinderCookie));
    const codeGrinderUI = new CodeGrinderUI(navBar, codeGrinder, cookie => window.localStorage.setItem(codegrinderCookie, cookie));

    let currentProblemsFiles;
    let currentDotFile;
    let currentProblemUnique;
    function switchProblem(unique) {
        currentProblemUnique = unique;
        fileSystem.clear();
        tabs.closeAll();
        for (let filename in currentProblemsFiles[unique]) {
            const content = currentProblemsFiles[unique][filename];
            fileSystem.touch("/" + filename).content = content;
            if (!filename.includes("test") && !(["doc/doc.md", "doc/index.html", "Makefile", ".gitignore"].includes(filename))) {
                tabs.addSwitchTab("/" + filename, content);
            }
        }
        fileSystem.touch("/.run_all_tests.py").content = `
import unittest
loader = unittest.TestLoader()
start_dir = './tests'
suite = loader.discover(start_dir)
runner = unittest.TextTestRunner()
runner.run(suite)`;
        mdElement.innerHTML = fileSystem.touch("/doc/index.html").content;
        fileSystemUI.refreshUI();
        const finished = currentDotFile.completed.has(unique);
        codeGrinderUI.buttonGrade.innerText = finished ? "Finished" : "Grade";
        codeGrinderUI.buttonGrade.disabled = finished;

    }
    function problemSetHandler({ problemsFiles, dotFile }, unique) {
        currentProblemsFiles = problemsFiles;
        currentDotFile = dotFile;
        let firstUnfinished = null;
        codeGrinderUI.problemsList.innerText = "";
        for (let problem in currentDotFile.problems) {
            const li = document.createElement("li");
            const button = document.createElement("button");
            li.appendChild(button);
            codeGrinderUI.problemsList.appendChild(li);
            if (currentDotFile.completed.has(problem)) {
                button.innerText = "✓ " + problem;
            } else {
                button.innerText = problem;
                if (!firstUnfinished) {
                    firstUnfinished = problem;
                }
            }
            button.addEventListener("click", async () => {
                switchProblem(problem);
            })
        }
        switchProblem(unique || firstUnfinished || Object.keys(problemsFiles)[0]);
    }
    codeGrinderUI.buttonRunTests.addEventListener("click", () => {
        runPython("/.run_all_tests.py");
    })
    function toFiles(directory, path = "/", files = {}) {
        for (let name in directory.children) {
            const node = directory.children[name];
            // If is directory
            if (node.children) {
                toFiles(node, path + name + "/", files);
            } else {
                // TODO
                // Need to support binary and utf8
                // Uint8Array.from(atob(btoa(String.fromCharCode(...new Uint8Array([0,5,128,255,200])))),c=>c.charCodeAt(0))
                try {
                    files[path + name] = btoa(node.content);
                } catch {
                    console.error("couldn't btoa", node.content)
                }
            }
        }
        return files;
    }
    codeGrinderUI.buttonSync.addEventListener("click", async () => {
        const files = toFiles(fileSystem.rootNode, "");
        await codeGrinder.commandSync((await codeGrinderUI.me), files, currentDotFile, currentProblemUnique);
    })
    codeGrinderUI.buttonReset.addEventListener("click", async () => {
        currentProblemsFiles[currentProblemUnique] = await codeGrinder.commandReset(currentDotFile, currentProblemUnique);
        switchProblem(currentProblemUnique);
    })
    codeGrinderUI.buttonGrade.addEventListener("click", async () => {
        const files = toFiles(fileSystem.rootNode, "");
        await codeGrinder.commandGrade((await codeGrinderUI.me), files, currentDotFile, currentProblemUnique, stdoutStr => {
            writeTerminal(stdoutStr, "green");
        }, stderrStr => {
            writeTerminal(stderrStr, "darkgreen");
        });
        await codeGrinder.commandGet(currentDotFile.assignmentID).then(res => problemSetHandler(res, currentProblemUnique));
    })
    codeGrinder.actionHandler = async (action) => {
        const files = toFiles(fileSystem.rootNode, "");
        await codeGrinder.commandAction((await codeGrinderUI.me), files, currentDotFile, currentProblemUnique,
            () => {
                writeTerminal(stdoutStr, "purple");
            }, stdoutStr => {
                writeTerminal(stdoutStr, "purple");
            }, stderrStr => {
                writeTerminal(stderrStr, "darkpurple");
            });
    }
    codeGrinderUI.problemSetHandler = problemSetHandler;
    const urlSession = urlParams.get("session");
    let codeGrinderReadyPromise = new Promise((resolve) => resolve());
    if (urlSession) {
        codeGrinderReadyPromise = codeGrinder.login(urlSession);
        codeGrinderReadyPromise.then(() => { codeGrinderUI.me = codeGrinder.getMe(); codeGrinderUI.updateAuthenticationStatus() });
        codeGrinderUI.buttonAuthenticator.style.display = "none";
    }
    const urlAssignment = urlParams.get('assignment');
    if (urlAssignment) {
        // Simplify interface if assignment is known
        newTab.style.display = "none";
        saveCurrent.style.display = "none";
        saveAll.style.display = "none";
        codeGrinderUI.buttonAssignments.style.display = "none";
        codeGrinderUI.buttonSync.style.display = "none";
        tabs.autoSave = true;
        codeGrinderReadyPromise.then(() => codeGrinder.commandGet(urlAssignment)).then(res => problemSetHandler(res));
        let lastSyncedChange = mostRecentChange;
        setInterval(async () => {
            const currentFiles = toFiles(fileSystem.rootNode, "");
            for (let filename in currentProblemsFiles[currentProblemUnique]) {
                const content = currentProblemsFiles[currentProblemUnique][filename];
                if (atob(currentFiles[filename]) !== content) {
                    if (mostRecentChange > lastSyncedChange) {
                        lastSyncedChange = mostRecentChange;
                        console.log("Auto Sync")
                        await codeGrinder.commandSync((await codeGrinderUI.me), currentFiles, currentDotFile, currentProblemUnique);
                        break;
                    }
                }
            }
        }, 5000);
    }
}
const urlDummy = urlParams.get("dummy");
if (urlDummy) {
    newTab.style.display = "none";
    saveCurrent.style.display = "none";
    saveAll.style.display = "none";
    filesButton.style.display = "none";
    document.getElementById("instructions_container").style.display = "none";
    document.getElementsByClassName("tabs-container")[0].style.display = "none";
    document.getElementsByClassName("path-input")[0].style.display = "none";
    run.style.position = "absolute";
    run.style.right = 0;
    run.style.top = 0;
    run.style.zIndex = 1;
    run.style.borderRadius = "100%";
    run.style.backgroundColor = "green";
    run.style.margin = "20px";
    tabs.autoSave = true;
    tabs.addSwitchTab("/main.py", "")
} else {
    setupCodegrinder();
}