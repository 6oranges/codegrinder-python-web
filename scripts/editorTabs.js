import { nameFromPath } from './directoryTree.js';
const modelist = ace.require("ace/ext/modelist");
function createAceEditor(element) {
  const editor = ace.edit(element);
  editor.setTheme("ace/theme/monokai");
  // use setOptions method to set several options at once
  editor.setOptions({
    copyWithEmptySelection: true,
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true,
    mergeUndoDeltas: "always",
  });
  return editor;
}
const UNTITLED = "untitled";
class Tab {
  // Private members
  #nameElement = null;
  #saved = null;
  #path = null;
  #ace = null;
  constructor(path = UNTITLED, content = "") {
    // Set up Tab
    this.element = document.createElement('li');
    this.#nameElement = document.createElement("span");
    this.element.appendChild(this.#nameElement);
    this.closeElement = document.createElement('button');
    this.element.appendChild(this.closeElement);

    // Set up editor
    this.editor = document.createElement("div");
    this.#ace = createAceEditor(this.editor);
    this.content = content;
    this.#ace.getSession().on("change", (delta) => {
      if (delta.action === "insert" || delta.action === "remove") {
        this.saved = false;
      }
    });
    this.#ace.commands.addCommand({
      name: "saveFile",
      bindKey: { win: "Ctrl-S", mac: "Command-S" },
      exec: (editor) => {
        this.saveHandler(this.path, this.content);
      }
    });
    // Set magic properties
    this.path = path;
    this.saved = true;
    this.saveHandler = null;
  }
  updateSize() {
    this.#ace.resize();
  }
  destroy() {
    this.#ace.destroy();
  }
  get saved() {
    return this.#saved;
  }
  set saved(value) {
    this.#saved = value;
    this.closeElement.innerText = this.saved ? "✖" : "⬤";
  }
  get path() {
    return this.#path;
  }
  set path(value) {
    this.#path = value;
    this.#nameElement.innerText = this.name;
    this.element.title = value;
    const mode = value === UNTITLED ? "ace/mode/python" : modelist.getModeForPath(this.path).mode;
    this.#ace.session.setMode(mode);
  }
  get name() {
    return nameFromPath(this.path);
  }
  get content() {
    return this.#ace.getValue();
  }
  set content(value) {
    this.#ace.setValue(value, -1);
  }
}
class Tabs {
  constructor(tabbedEditorElement, saveHandler) {
    this.tabbedEditorElement = tabbedEditorElement;
    this.tabListElement = document.createElement("ol");
    this.tabListElement.classList.add("tabs-container");
    this.tabbedEditorElement.appendChild(this.tabListElement);
    this.pathInput = document.createElement("input");
    // This next line to make the browser happy
    this.pathInput.name = "path";
    this.pathInput.classList.add("path-input");
    this.tabbedEditorElement.appendChild(this.pathInput);
    this.editorListElement = document.createElement("div");
    this.editorListElement.classList.add("editor-container");
    this.tabbedEditorElement.appendChild(this.editorListElement);
    this.pathInput.addEventListener("change", () => {
      this.tabs[this.currentTab].saved = false;
      this.tabs[this.currentTab].path = this.pathInput.value;
    })

    this.saveHandler = saveHandler;
    this.tabs = [];
    this.addNewTab();

    // Attach a listener to the resize event of the editor's container
    new ResizeObserver(() => {
      this.tabs[this.currentTab].updateSize();
    }).observe(this.editorListElement);
  };
  saveTab(tab) {
    if (tab.saved) {
      return;
    }
    if (tab.path === UNTITLED) {
      let response = window.prompt("Filename");
      if (!response) {
        return;
      }
      tab.path = response;
    }
    if (!tab.path.startsWith("/")) {
      tab.path = "/" + tab.path;
    }
    tab.saved = true;
    if (tab === this.tabs[this.currentTab]) {
      this.pathInput.value = this.tabs[this.currentTab].path;
    }
    this.saveHandler(tab.path, tab.content);
  }
  saveCurrentTab() {
    this.saveTab(this.tabs[this.currentTab]);
  }
  saveAllTabs() {
    for (let tab of this.tabs) {
      this.saveTab(tab);
    }
  }
  addNewTab(tab = new Tab()) {
    tab.saveHandler = (path, content) => {
      this.saveTab(tab);
    };
    tab.element.addEventListener("click", () => {
      this.switchTab(this.tabs.indexOf(tab));
    })
    tab.closeElement.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!tab.saved) {
        const result = window.confirm(tab.name + " is not saved, close anyway?")
        if (!result) {
          return;
        }
      }
      const currentTab = this.tabs[this.currentTab];
      const closingCurrent = currentTab === tab;
      this.tabListElement.removeChild(tab.element);
      this.editorListElement.removeChild(tab.editor);
      const index = this.tabs.indexOf(tab);
      tab.destroy();
      this.tabs.splice(index, 1);
      if (closingCurrent) {
        if (this.tabs.length === 0) {
          this.addNewTab();
        }
        this.switchTab(0);
      } else {
        this.switchTab(this.tabs.indexOf(currentTab));
      }
    });
    this.tabListElement.appendChild(tab.element);
    this.editorListElement.appendChild(tab.editor);
    this.tabs.push(tab);
    this.switchTab(this.tabs.length - 1);
  };
  switchTab(tabIndex) {
    this.currentTab = tabIndex;
    for (let tab in this.tabs) {
      if (tab == this.currentTab) {
        this.tabs[tab].editor.style.display = "block";
        this.tabs[tab].editor.focus();
        this.tabs[tab].element.classList.add("active");
      } else {
        this.tabs[tab].editor.style.display = "none";
        this.tabs[tab].element.classList.remove("active");
      }
    }
    this.tabs[this.currentTab].updateSize();
    this.pathInput.value = this.tabs[this.currentTab].path;
  };
  addSwitchTab(path, content) {
    for (let tab in this.tabs) {
      if (this.tabs[tab].path === path) {
        this.switchTab(tab);
        return;
      }
    }
    this.addNewTab(new Tab(path, content));
  }
};
export { Tab, Tabs };