import { Tabs } from './editorTabs.js';
import { FileSystem, FileSystemUI, extension } from './directoryTree.js';
import { PythonRunner } from './pythonHandler.js'

const output_terminal = document.getElementById("output_terminal");
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

// Set up example fileSystem
fileSystem.touch("/etc/www/test/index.html");
fileSystem.touch("/etc/www/test/style.css");
fileSystem.touch("/etc/www/test/potato.txt");
fileSystem.touch("/etc/www/test/test.js");
fileSystem.touch("/turtle.py").content = `import time
print('hi')
t1=time.time()
while time.time()-t1<3:
    pass
print('bye')`;
fileSystem.touch("/doc.md").content = `
# 31.4) Bookend List
Create a function \`bookend_list\` that consumes
a list as a parameter and returns the first and last
elements of that list but as part of a new list. If
the original list is empty, return an empty list instead.
Unit test this function sufficiently.`;
fileSystemUI.refreshUI();

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
tabs.addSwitchTab('/turtle.py', fileSystem.touch('/turtle.py').content);
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
    }
    previousSpan.innerText += str;
    if (str.includes("\n")) {
        output_terminal.scrollTop = output_terminal.scrollHeight;
    }
}
let pythonRunning = false;
run.disabled = true;
pythonRunner.ready.then(() => {
    run.disabled = false;
    run.innerText = "Run";
});
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
        pythonRunning = false;
        run.innerText = "Run";
        run.disabled = false;
    }
})
