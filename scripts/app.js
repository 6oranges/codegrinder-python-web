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
const tabs = new Tabs(document.getElementById("tabs"), (path, content) => {
    const fout = fileSystem.touch(path);
    fout.content = content;
    fileSystemUI.refreshUI();
});

const pythonRunner = new PythonRunner();
const codegrinderCookie = "codegrinderCookie";
const codeGrinder = new CodeGrinder(window.localStorage.getItem(codegrinderCookie));
const codeGrinderUI = new CodeGrinderUI(navBar, codeGrinder, cookie => window.localStorage.setItem(codegrinderCookie, cookie));
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
    if (str.includes("\n")) {
        output_terminal_label.scrollTop = output_terminal_label.scrollHeight;
    }
    previousSpan.innerText += str;
}

// Set up python
let pythonRunning = false;
run.disabled = true;
pythonRunner.ready.then(() => {
    run.disabled = false;
    run.innerText = "Run";
    writeTerminal(">> ", "orange");
});
input_terminal.addEventListener("keydown", event => {
    if (event.code === "Enter" && pythonRunning) {
        let value = input_terminal.value + "\n";
        writeTerminal(value, "grey");
        pythonRunner.writeStdin(value);
        input_terminal.value = "";
        input_terminal.focus();
        event.preventDefault();
    }
})
pythonRunner.setStdoutCallback(str => {
    writeTerminal(str, "black");
})
pythonRunner.setStderrCallback(str => {
    writeTerminal(str, "red");
});
async function runPython(path) {
    if (pythonRunning) {
        run.disabled = true;
        pythonRunning = false;
        pythonRunner.stopPython();
        run.innerText = "Stopping";
    } else {
        run.innerText = "Stop"
        pythonRunning = true;
        writeTerminal("Running " + path + "\n", "orange");
        await pythonRunner.runPython(fileSystem, path);
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

// Set up codegrinder
let currentProblemsFiles;
let currentDotFile;
function switchProblem(identifier) {
    fileSystem.clear();
    tabs.closeAll();
    for (let filename in currentProblemsFiles[identifier]) {
        const content = currentProblemsFiles[identifier][filename];
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
}
function problemSetHandler({ problemsFiles, dotFile }) {
    currentProblemsFiles = problemsFiles;
    currentDotFile = dotFile;
    console.log(currentDotFile);

    codeGrinderUI.problemsList.innerText = "";
    for (let problem in currentDotFile.problems) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.innerText = problem;
        li.appendChild(button);
        codeGrinderUI.problemsList.appendChild(li);
        button.addEventListener("click", async () => {
            switchProblem(problem);
        })
    }
    switchProblem(Object.keys(problemsFiles)[0]);
}
codeGrinderUI.runTestsHandler = () => runPython("/.run_all_tests.py");
codeGrinderUI.problemSetHandler = problemSetHandler;
const urlAssignment = urlParams.get('assignment');
if (urlAssignment) {
    // Simplify interface if assignment is known
    newTab.style.display = "none";
    saveCurrent.style.display = "none";
    saveAll.style.display = "none";
    codeGrinderUI.buttonAssignments.style.display = "none";
    codeGrinder.commandGet(urlAssignment).then(res => problemSetHandler(res));
}
