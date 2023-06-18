import { Tabs } from './editorTabs.js';
import { FileSystem, FileSystemUI, extension } from './directoryTree.js';
import { PythonRunner } from './pythonHandler.js'
import { CodeGrinder } from './codeGrinder.js';
const output_terminal_label = document.getElementById("output_terminal")
const output_terminal = output_terminal_label.getElementsByTagName("pre")[0];
const input_terminal = output_terminal_label.getElementsByTagName("input")[0];
const run = document.getElementById("run");
const mdElement = document.getElementById("instructions");
const sideBarToggleElement = document.getElementById("side_bar_toggle");
const sideBar = document.getElementById("side_bar");
const md = window.markdownit();
const fileSystem = new FileSystem();
const fileSystemUI = new FileSystemUI(fileSystem, document.getElementById("directory_tree"));
const tabs = new Tabs(document.getElementById("tabs"), (path, content) => {
    const fout = fileSystem.touch(path);
    fout.content = content;
    fileSystemUI.refreshUI();
});
const pythonRunner = new PythonRunner();
const codeGrinder=new CodeGrinder(window.localStorage.getItem("codegrinderCookie"));
window.debug=codeGrinder;

// Set up example fileSystem
fetch("python/turtle.py").then(response => response.text()).then(text => {
    fileSystem.touch("/turtle.py").content = text;
    fileSystemUI.refreshUI();
})
fetch("python/svg.py").then(response => response.text()).then(text => {
    fileSystem.touch("/svg.py").content = text;
    fileSystemUI.refreshUI();
})
fileSystem.touch("/doc.md").content = `
# 31.4) Bookend List
Create a function \`bookend_list\` that consumes
a list as a parameter and returns the first and last
elements of that list but as part of a new list. If
the original list is empty, return an empty list instead.
Unit test this function sufficiently.`;
fileSystem.touch("/test.py").content = `raise Exception("123456"*1000)#import turtle
#turtle.forward(100)`
fileSystemUI.refreshUI();
tabs.addSwitchTab('/test.py', fileSystem.touch('/test.py').content);

// Set up sidebar
let sideBarOpen = false;
function toggleSideBar(e) {
    sideBarOpen = !sideBarOpen;
    sideBar.style.width = sideBarOpen ? "fit-content" : "0"
    sideBarToggleElement.innerText = sideBarOpen ? "<<" : ">>";
    e?.stopPropagation();
}
// Click away from file tree to close
document.addEventListener("click", (e) => {
    if (sideBarOpen) {
        toggleSideBar(e);
    }
})
sideBarToggleElement.addEventListener("click", toggleSideBar);

// Set up tabs
fileSystemUI.fileClick = (fileNode, path) => {
    tabs.addSwitchTab(path, fileNode.content);
    toggleSideBar();
    if (extension(path) === "md") {
        mdElement.innerHTML = md.render(fileNode.content);
    }
};
const newTab = document.getElementById("new_tab");
newTab.addEventListener("click", () => {
    tabs.addNewTab();
})
const saveCurrent = document.getElementById("save_current");
const saveAll = document.getElementById("save_all");
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
        previousSpan = document.createElement("span");
        previousSpan.style.color = color;
        output_terminal.appendChild(previousSpan);
        const resetFocus = document.activeElement === input_terminal;
        output_terminal.appendChild(input_terminal);
        if (resetFocus) {
            input_terminal.focus();
        }
    }
    previousSpan.innerText += str;
    if (str.includes("\n")) {
        output_terminal_label.scrollTop = output_terminal_label.scrollHeight;
    }
}
let pythonRunning = false;
run.disabled = true;
pythonRunner.ready.then(() => {
    run.disabled = false;
    run.innerText = "Run";
    writeTerminal(">> ", "orange");
});
input_terminal.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && pythonRunning) {
        writeTerminal(input_terminal.value + "\n", "grey");
        pythonRunner.writeStdin(input_terminal.value + "\n");
        input_terminal.value = "";
        input_terminal.focus();
    }
})
pythonRunner.setStdoutCallback((str) => {
    writeTerminal(str, "black");
})
pythonRunner.setStderrCallback((str) => {
    writeTerminal(str, "red");
});
run.addEventListener("click", async () => {
    if (pythonRunning) {
        run.disabled = true;
        pythonRunning = false;
        pythonRunner.stopPython();
        run.innerText = "Stopping";
    } else {
        run.innerText = "Stop"
        pythonRunning = true;
        writeTerminal("Running " + tabs.tabs[tabs.currentTab].path + "\n", "orange");
        await pythonRunner.runPython(fileSystem, tabs.tabs[tabs.currentTab].path);
        await pythonRunner.ready;
        writeTerminal(">> ", "orange");
        pythonRunning = false;
        run.innerText = "Run";
        run.disabled = false;
    }
})
