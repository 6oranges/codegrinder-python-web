// Consider https://github.com/use-strict/file-system-access
// Because pyodide supports pyodide.mountNativeFS() (takes a FileSystemDirectoryHandle)
function nameFromPath(path) {
  const parts = path.split("/");
  return parts[parts.length - 1];
}
function extension(path) {
  const parts = nameFromPath(path).split(".");
  return parts[parts.length - 1];
}
class FileNode {
  constructor(content = "") {
    this.content = content;
  };
};
class DirectoryNode {
  constructor(children = {}) {
    this.children = children;
    this.collapsed = false;
  };
};
class FileSystem {
  constructor(rootNode = new DirectoryNode()) {
    if (!(rootNode instanceof DirectoryNode)) {
      throw new Error("Filesystem must have directory for root");
    }
    this.rootNode = rootNode;
  }
  // Returns the FileNode at path or creates it
  // Throws if path has problems such as
  // trying to use an existing file as a directory
  // touching a directory
  // Folders may be created even on throws
  touch(path) {
    const parts = path.split("/");
    if (parts[0] !== "") {
      throw new Error("Path must be absolute");
    }
    if (parts.length < 2) {
      throw new Error("Path must be absolute");
    }
    parts.shift();
    const name = parts.pop();
    let currNode = this.rootNode;
    for (let part of parts) {
      if (!(part in currNode.children)) {
        currNode.children[part] = new DirectoryNode();
      }
      currNode = currNode.children[part];
      if (!(currNode instanceof DirectoryNode)) {
        throw new Error("Cannot access children of FileNode");
      }
    }
    if (!(name in currNode.children)) {
      currNode.children[name] = new FileNode();
    }
    if (!(currNode.children[name] instanceof FileNode)) {
      throw new Error("Referenced Node is not a FileNode");
    }
    return currNode.children[name];
  }
}
class FileSystemUI {
  constructor(fileSystem, treeElement, fileClick = (fileNode, path) => { }) {
    this.fileSystem = fileSystem;
    if (!(this.fileSystem instanceof FileSystem)) {
      throw new Error("FileSystemUI requires a FileSystem");
    }
    this.treeElement = treeElement;
    this.fileClick = fileClick;
    this.refreshUI();
  };
  refreshUI() {
    this.treeElement.innerText = "";
    this.#presentNode(this.fileSystem.rootNode, this.treeElement, "")
  };
  // Private method to add a node to the UI recursively
  #presentNode(node, parentContainer, path) {
    const nodeElement = document.createElement('li');
    const nodeName = nameFromPath(path);
    if (node instanceof DirectoryNode) {
      nodeElement.innerText = nodeName + "/";
      nodeElement.classList.add("folder");
      if (node.collapsed) {
        nodeElement.classList.add("collapsed")
      }
      const nodeUL = document.createElement('ul');
      for (let child of Object.keys(node.children)) {
        this.#presentNode(node.children[child], nodeUL, path + "/" + child);
      }
      nodeElement.appendChild(nodeUL);
      nodeElement.addEventListener('click', (event) => {
        node.collapsed = !node.collapsed;
        nodeElement.classList.toggle("collapsed");
        event.stopPropagation();
      });
    } else {
      nodeElement.innerText = nodeName;
      nodeElement.classList.add("file", node.fileType)
      // Don't use function keyword because we don't want new this
      // I only support function keywords on their own line anyway
      nodeElement.addEventListener('click', (event) => {
        this.fileClick(node, path)
        event.stopPropagation();
      });
    }
    parentContainer.appendChild(nodeElement);
  };
}
export { FileSystem, FileSystemUI, nameFromPath, extension };