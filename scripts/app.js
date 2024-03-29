import { Tabs } from './editorTabs.js';
import { FileSystem, FileSystemUI, extension } from './directoryTree.js';
import { PythonRunner } from './pythonHandler.js'
import { CodeGrinder, CodeGrinderUI } from './codeGrinder.js';
import { decodeBase64ToUTF8, encodeUTF8OrLatin1AsBase64 } from './encodingHelpers.js';
const output_terminal_label = document.getElementById("output_terminal")
const output_terminal = output_terminal_label.getElementsByTagName("pre")[0];
const input_terminal = output_terminal_label.getElementsByTagName("textarea")[0];
const filesButton = document.getElementById("files_button");
const filesList = document.getElementById("files_list");
const run = document.getElementById("run");
const newTab = document.getElementById("new_tab");
const saveCurrent = document.getElementById("save_current");
const saveAll = document.getElementById("save_all");
const embed = document.getElementById("embed");
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
embed.addEventListener("click", () => {
    const files = encodeURIComponent(JSON.stringify(fileSystem.rootNode));
    const string = `<div style="position: relative; padding-bottom: 56.25%; padding-top: 0px; height: 0; overflow: hidden;"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="${location.origin + location.pathname}?dummy=true&files=${files}"></iframe></div>`;
    navigator.clipboard.writeText(string);
    console.log(string);
})
const urlFiles = urlParams.get("files");
if (urlFiles) {
    fileSystem.rootNode = JSON.parse(urlFiles);
    fileSystemUI.refreshUI();
    tabs.closeAll();
    for (let file in fileSystem.rootNode.children) {
        if (!fileSystem.rootNode.children[file].children) {
            tabs.addSwitchTab("/" + file, fileSystem.rootNode.children[file].content);
        }
    }
}

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
let turtleRunning = false;
window.iframeSharedArrayBufferWorkaroundServiceWorkerLoss = function () {
    pythonRunner.stopPython();
}
let serverStdin;
let skulptInput;
run.disabled = true;
pythonRunner.ready.then(() => {
    run.disabled = false;
    run.innerText = "Run";
    writeTerminal(">> ", "orange");
});
input_terminal.addEventListener("keydown", event => {
    input_terminal.style.color = pythonRunning || turtleRunning ? "grey" : "blue";
    if (event.key === "Enter") {
        const withoutTrailingNewline = input_terminal.value.replace(/\n+$/, "")
        let value = withoutTrailingNewline + "\n";
        input_terminal.value = "";
        input_terminal.focus();
        event.preventDefault();
        if (serverRunning) {
            serverStdin(value)
            return;
        }
        if (turtleRunning) {
            writeTerminal(value, "grey");
            skulptInput?.(withoutTrailingNewline)
            return;
        }
        if (pythonRunning) {
            writeTerminal(value, "grey");
            pythonRunner.writeStdin(value);
        } else {
            writeTerminal(value, "blue");
            run.innerText = "Stop"
            pythonRunning = true;
            if (tabs.tabs[tabs.currentTab].path.endsWith(".sql")) {
                value = 'run_sql_line("""' + value + '""")'
            }
            pythonRunner.runPython(fileSystem, value).then(async () => {
                await pythonRunner.ready;
                setTimeout(() => writeTerminal(">> ", "orange"), 1000);
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
    Sk.configure({
        inputfun: function () {
            return new Promise((resolve, reject) => {
                skulptInput = resolve;
            })
        }, output: (text) => { writeTerminal(text, "black") }, read: builtinRead
    });
    document.getElementById("turtle").style.pointerEvents = "none";
    (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'turtle';
    var myPromise = Sk.misceval.asyncToPromise(function () {
        return Sk.importMainWithBody("<stdin>", false, code, true);
    });
    await myPromise.then(function (mod) {
    },
        function (err) {
            writeTerminal(err.toString() + "\n", "red");
        });
}
pythonRunner.setToMainThreadCallback(data => {
    const img = new Image();
    img.src = "data:image/png;base64," + data.showImage;
    document.getElementById("turtle").innerText = "";
    document.getElementById("turtle").appendChild(img);
});
async function runPython(path, clearFiles = false) {
    document.getElementById("turtle").innerText = "";
    let content = "";
    try {
        content = fileSystem.touch(path).content;
    } catch {
        // If the above failed it is most likely because the path is invalid
        // In which case pyodide has a better error message
        // Pass invalid path on intentionally
    }
    if (content.includes("import turtle")) {
        turtleRunning = true;
        await runSkulpt(content);
        turtleRunning = false;
        writeTerminal(">> ", "orange")
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
        await pythonRunner.runPython(fileSystem, `run_script(".${path}")`, clearFiles);
        await pythonRunner.ready;
        setTimeout(() => writeTerminal(">> ", "orange"), 1000);
        pythonRunning = false;
        run.innerText = "Run";
        run.disabled = false;
    }
}
run.addEventListener("click", async () => {
    const path = tabs.tabs[tabs.currentTab].path
    if (path.endsWith(".sql")) {
        if (pythonRunning) {
            run.disabled = true;
            pythonRunning = false;
            pythonRunner.stopPython();
            run.innerText = "Stopping";
        } else {
            run.innerText = "Stop"
            pythonRunning = true;
            writeTerminal("Running " + path + "\n", "orange");
            await pythonRunner.runPython(fileSystem, "run_sql_file('." + path + "')")
            await pythonRunner.ready;
            setTimeout(() => writeTerminal(">> ", "orange"), 1000);
            pythonRunning = false;
            run.innerText = "Run";
            run.disabled = false;
        }
    } else {
        runPython(path);
    }
})

function setupCodegrinder() {
    const codegrinderCookie = "codegrinderCookie";
    const codeGrinder = new CodeGrinder(window.localStorage.getItem(codegrinderCookie));
    const codeGrinderUI = new CodeGrinderUI(navBar, codeGrinder, cookie => window.localStorage.setItem(codegrinderCookie, cookie));

    let currentProblemsFiles;
    let currentDotFile;
    let currentProblemUnique;
    let currentProblemsWhitelist;
    function switchProblem(unique) {
        currentProblemUnique = unique;
        fileSystem.clear();
        tabs.closeAll();
        const modules = [];
        for (let filename in currentProblemsFiles[unique]) {
            if (filename.endsWith(".sql")) {
                modules.push("sqlite3", "pandas");
            }
            let content = currentProblemsFiles[unique][filename];
            if (filename.includes("requirements.txt")) {
                modules.push(...content.split("\n").filter(value => !value.includes("#")));
            }
            if (filename.includes("asttest")) {
                // A super hack, changes asttest.py to avoid problems with tracer
                content = content.replace(`# write tracing results to a *.cover file
        tracer.results().write_results(coverdir='.')
        # count how many lines were skipped
        all_skipped = []
        f = open(basename+".cover")
        lineno = 0
        for line in f:
            lineno += 1
            if line[:6] == ">>>>>>":
                # skipped line
                all_skipped.append((line[8:], lineno))
        f.close()
        # clean up cover file
        os.remove(basename+".cover")
        # count executable lines
        visitor = FindExecutableLines()
        visitor.visit(self.tree)
        all_executable_lines = set(visitor.lines)`, `# count executable lines
        visitor = FindExecutableLines()
        visitor.visit(self.tree)
        all_executable_lines = set(visitor.lines)
        # count how many lines were skipped
        lines_hit = set()
        for filename, lineno in tracer.results().counts:
            if basename in ".".join(filename.split(".")[:-1]).split("/"):
                lines_hit.add(lineno)
        all_skipped = []
        source = self.file.split("\\n")
        for line in all_executable_lines:
            if line not in lines_hit:
                all_skipped.append((source[line-1], line))`)
            }
            fileSystem.touch("/" + filename).content = content;
            if (currentProblemsWhitelist[unique][filename]) {
                tabs.addSwitchTab("/" + filename, content);
            }
        }
        if (modules.length > 0) {
            pythonRunner.loadModules(modules);
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
        if (fileSystem.rootNode.children?.bin.children?.["setup.py"]) {
            runPython("/bin/setup.py", true);
        }

    }
    function problemSetHandler({ problemsFiles, dotFile, problemsWhitelist }, current) {
        currentProblemsFiles = problemsFiles;
        currentDotFile = dotFile;
        currentProblemsWhitelist = problemsWhitelist;
        let firstUnfinished = null;
        codeGrinderUI.problemsList.innerText = "";
        const keys = [];
        for (let key in currentDotFile.problems) {
            keys.push(key);
        }
        keys.sort()
        for (let problem of keys) {
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
        if (current && !currentDotFile.completed.has(current)) {
            switchProblem(current)
        } else {
            switchProblem(firstUnfinished || keys[0]);
        }
    }
    codeGrinderUI.buttonRunTests.addEventListener("click", () => {
        runPython("/.run_all_tests.py", true);
    })
    function toFiles(directory, path = "/", files = {}) {
        for (let name in directory.children) {
            const node = directory.children[name];
            // If is directory
            if (node.children) {
                toFiles(node, path + name + "/", files);
            } else {
                files[path + name] = encodeUTF8OrLatin1AsBase64(node.content);
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
        embed.style.display = "none";
        tabs.autoSave = true;
        codeGrinderReadyPromise.then(() => codeGrinder.commandGet(urlAssignment)).then(res => problemSetHandler(res));
        let lastSyncedChange = mostRecentChange;
        setInterval(async () => {
            const currentFiles = toFiles(fileSystem.rootNode, "");
            for (let filename in currentProblemsFiles[currentProblemUnique]) {
                const content = currentProblemsFiles[currentProblemUnique][filename];
                if (decodeBase64ToUTF8(currentFiles[filename]) !== content) {
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
    embed.style.display = "none";
    document.getElementById("instructions_container").style.display = "none";
    if (Object.keys(fileSystem.rootNode.children).length === 0) {
        document.getElementsByClassName("tabs-container")[0].style.display = "none";
        tabs.addSwitchTab("/main.py", "")
    }
    const modules = [];
    if (urlFiles.includes(".sql")) {
        modules.push("sqlite3", "pandas");
    }
    if (fileSystem.rootNode.children["requirements.txt"]?.content) {
        modules.push(...fileSystem.rootNode.children["requirements.txt"]?.content.split("\n").filter(value => !value.includes("#")));
    }
    if (modules.length > 0) {
        pythonRunner.loadModules(modules);
    }
    document.getElementsByClassName("path-input")[0].style.display = "none";
    run.style.position = "absolute";
    run.style.right = 0;
    run.style.top = 0;
    run.style.zIndex = 1;
    run.style.borderRadius = "100%";
    run.style.backgroundColor = "green";
    run.style.margin = "20px";
    tabs.autoSave = true;
} else {
    setupCodegrinder();
}