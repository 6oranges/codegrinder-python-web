import { createPrompt } from "./prompt.js";
// Hacky trampoline to get around cors
// TODO: ask Russ to fix
// blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource
function trampoline(url, options) {
  return fetch("/trampoline", {
    method: "POST",
    body: JSON.stringify({ url, options }),
    headers: {
      'Content-Type': "application/json"
    },
  })
}
class CodeGrinder {
  constructor(cookie, host = "https://codegrinder.cs.utahtech.edu") {
    this.host = host;
    this.cookie = cookie
  }
  #cookied(url, options) {
    if (!options) {
      options = {};
    }
    if (!options.headers) {
      options.headers = {};
    }
    options.headers.Cookie = this.cookie;
    return trampoline(url, options);
  }
  async #getObject(path) {
    const response = await this.#cookied(this.host + "/v2" + path);
    if (response.status !== 200) {
      const text = await response.text();
      return null;
    } else {
      const json = await response.json();
      return json;
    }
  }
  async #postObject(path, data) {
    const response = await this.#cookied(this.host + "/v2" + path, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (response.status !== 200) {
      const text = await response.text();
      return null;
    } else {
      const json = await response.json();
      return json;
    }
  }
  async login(key) {
    const json = await this.#getObject("/users/session?key=" + key);
    if (json) {
      this.cookie = json.cookie
    }
    return json;
  }
  // Use this to determine if the user is logged in.
  getMe() {
    return this.#getObject("/users/me");
  }
  getUserAssignments(id) {
    return this.#getObject("/users/" + id + "/assignments");
  }
  getAssignment(id) {
    return this.#getObject("/assignments/" + id);
  }
  getProblemSets() {
    return this.#getObject("/problem_sets");
  }
  getProblemSet(id) {
    return this.#getObject("/problem_sets/" + id);
  }
  getProblemTypes() {
    return this.#getObject("/problem_types");
  }
  getProblemType(typeName) {
    return this.#getObject("/problem_types/" + typeName);
  }
  getProblemSetProblems(id) {
    return this.#getObject("/problem_sets/" + id + "/problems");
  }
  getProblemSetProblem(problemSetId, id) {
    return this.#getObject("/problem_sets/" + problemSetId + "/problems/" + id);
  }
  getProblemSteps(id) {
    return this.#getObject("/problems/" + id + "/steps");
  }
  getProblemStep(problemId, step) {
    return this.#getObject("/problems/" + problemId + '/steps/' + step);
  }
  getProblem(id) {
    return this.#getObject("/problems/" + id);
  }
  getCourse(id) {
    return this.#getObject("/courses/" + id);
  }
  getLastCommit(assignmentId, problemId) {
    return this.#getObject("/assignments/" + assignmentId + "/problems/" + problemId + "/commits/last");
  }
  // See https://github.com/russross/codegrinder/blob/70d9a02cc8e3cf2868f19bb26e5b0b17304ccbc1/cli/get.go#L48C54-L48C54
  async commandGet(assignmentId) {
    const assignment = await this.getAssignment(assignmentId);
    // Codegrinder CMD called these functions but we don't use them
    // const course = await this.getCourse(assignment.courseID);
    // const problemSet = await this.getProblemSet(assignment.problemSetID);
    const problemSetProblems = await this.getProblemSetProblems(assignment.problemSetID);
    const commits = {};
    const infos = {};
    const problems = {};
    const steps = {};
    const types = {};
    for (let elt of problemSetProblems) {
      const problem = await this.getProblem(elt.problemID);
      problems[problem.unique] = problem;
      const info = {};
      const commit = await this.getLastCommit(assignment.id, problem.id);
      info.id = problem.id;
      if (commit) {
        info.step = commit.step;
      } else {
        info.step = 1;
      }
      const step = await this.getProblemStep(problem.id, info.step);
      infos[problem.unique] = info;
      commits[problem.unique] = commit;
      steps[problem.unique] = step;
      if (step.problemType !== "python3unittest") {
        console.warning("This only supports python3unittest not ", step.problemType)
      }
      if (!(step.problemType in types)) {
        types[step.problemType] = await this.getProblemType(step.problemType);
      }
    }
    const problemsFiles = {};
    for (let unique in steps) {
      const commit = commits[unique];
      const problem = problems[unique];
      const step = steps[unique];
      problemsFiles[unique] = {};
      const files = problemsFiles[unique];
      for (let name in step.files) {
        files[name] = atob(step.files[name]);
      }
      files["doc/index.html"] = step.instructions;

      if (commit !== null) {
        for (let name in commit.files) {
          files[name] = atob(commit.files[name]);
        }
      }

      for (let name in types[step.problemType].files) {
        if (files[name] !== undefined) {
          console.log("warning: problem type file is overwriting problem file: " + name);
        }
        files[name] = atob(types[step.problemType].files[name]);
      }
      // TODO: Not implemented
      if (commit !== null && commit.reportCard !== null && commit.reportCard.Passed && commit.score === 1.0) {
        nextStep(target, infos[unique], problem, commit, types);
      }
    }

    const dotFile = {
      assignmentID: assignment.id,
      problems: infos,
    };
    return { problemsFiles, dotFile };
  }
  mustConfirmCommitBundle(bundle) {
    const headers = new Headers();
    const url = `wss://${this.host}/v2/sockets/${bundle.ProblemType.Name}/${bundle.Commit.Action}`;
    const socket = new WebSocket(url, headers);

    socket.onopen = () => {
      const req = {
        CommitBundle: bundle
      };
      socket.send(JSON.stringify(req));
    };

    return new Promise((resolve, reject) => {
      socket.onmessage = (event) => {
        const reply = JSON.parse(event.data);

        if (reply.Error !== "") {
          console.log("Server returned an error:");
          console.log(reply.Error);
          reject(new Error(reply.Error));
        } else if (reply.CommitBundle) {
          resolve(reply.CommitBundle);
        } else if (reply.Event) {
          // Ignore the streamed data
        } else {
          reject(new Error("Unexpected reply from server"));
        }
      };

      socket.onerror = (event) => {
        console.log("Socket error:", event);
        reject(new Error("Socket error"));
      };

      socket.onclose = (event) => {
        console.log("Socket closed:", event);
        reject(new Error("Socket closed"));
      };
    });
  }
  async gatherStudent(files, dotfile, problem_unique) {
    const now = new Date();
    // get the assignment
    //const assignment = await this.getAssignment(dotfile.assignmentID);
    const info = dotfile.problems[problem_unique];
    const step = await this.getProblemStep(info.id, info.step);
    //const problemType = await this.getProblemType(step.problemType);
    // gather the commit files from the file system
    const filtered_files = {};
    for (const name in step.whitelist) {
      filtered_files[name] = files[name];
    }

    // form a commit object
    const commit = {
      id: 0,
      assignmentID: dotfile.assignmentID,
      problemID: info.id,
      step: info.step,
      files: filtered_files,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return commit;
  }
  async commandSync(user, files, dotfile, problem_unique) {
    const commit = await this.gatherStudent(files, dotfile, problem_unique);
    commit.action = "";
    commit.note = "grind sync";
    const unsigned = {
      userID: user.id,
      commit: commit,
    }

    // send the commit to the server
    const signed = await this.#postObject("/commit_bundles/unsigned", unsigned);
    // TODO: fix the server
    // this returns too much information: it returns the solution files
    // under problemSteps[0].solution with base64 encoding as usual
    // This was tested on a Testing Student canvas account. This be bad!
  }
}
class CodeGrinderUI {
  constructor(navBar, codeGrinder = new CodeGrinder("codegrinder=notloggedin"),
    authenticatorHandler = (cookie) => { },
    problemSetHandler = ({ problemsFiles, dotFile }) => { }) {
    this.codeGrinder = codeGrinder;
    const liAssignments = document.createElement("li");
    const liProblems = document.createElement("li");
    const liRunTests = document.createElement("li");
    const liGrade = document.createElement("li");
    const liSync = document.createElement("li");
    const liAuthenticator = document.createElement("li");
    const liEmbed = document.createElement("li");
    navBar.appendChild(liAssignments);
    navBar.appendChild(liProblems);
    navBar.appendChild(liRunTests);
    navBar.appendChild(liGrade);
    navBar.appendChild(liSync);
    navBar.appendChild(liAuthenticator);
    navBar.appendChild(liEmbed);
    this.buttonAssignments = document.createElement("button");
    this.buttonProblems = document.createElement("button");
    this.buttonRunTests = document.createElement("button");
    this.buttonGrade = document.createElement("button");
    this.buttonSync = document.createElement("button");
    this.buttonAuthenticator = document.createElement("button");
    this.buttonEmbed = document.createElement("button");
    liAssignments.appendChild(this.buttonAssignments);
    liProblems.appendChild(this.buttonProblems);
    liRunTests.appendChild(this.buttonRunTests);
    liGrade.appendChild(this.buttonGrade);
    liSync.appendChild(this.buttonSync);
    liAuthenticator.appendChild(this.buttonAuthenticator);
    liEmbed.appendChild(this.buttonEmbed);
    this.buttonAssignments.innerText = "Assignments";
    this.buttonProblems.innerText = "Problems";
    this.buttonRunTests.innerText = "Run Tests";
    this.buttonGrade.innerText = "Submit for grading";
    this.buttonSync.innerText = "Save & Sync";
    this.buttonEmbed.innerText = "Copy Embed Code";

    this.authenticatorHandler = authenticatorHandler;
    this.problemSetHandler = problemSetHandler;
    this.me = this.codeGrinder.getMe();

    this.assignmentsList = document.createElement("ol");
    this.assignmentsList.classList.add("dropdown");
    liAssignments.appendChild(this.assignmentsList);

    this.problemsList = document.createElement("ol");
    this.problemsList.classList.add("dropdown");
    liProblems.appendChild(this.problemsList);

    this.buttonAuthenticator.addEventListener("click", async () => {
      let user = await this.me;
      if (user) {
        this.codeGrinder.cookie = undefined;
      } else {
        const parts = (await createPrompt("CodeGrinder login key")).trim().split(" ");
        this.buttonAuthenticator.disabled = true;
        await this.codeGrinder.login(parts[parts.length - 1]);
        this.buttonAuthenticator.disabled = false;
      }
      this.authenticatorHandler(this.codeGrinder.cookie);
      this.me = this.codeGrinder.getMe();
      await this.#updateAuthenticationStatus();
    })
    this.buttonAssignments.addEventListener("click", async () => {
      const user = await this.me;
      if (!user) return;
      const assignments = await this.codeGrinder.getUserAssignments(user.id);
      this.assignmentsList.style.display = "block";
      this.assignmentsList.innerText = "";
      for (let assignment of assignments) {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.innerText = assignment.canvasTitle;
        li.appendChild(button);
        this.assignmentsList.appendChild(li);
        button.addEventListener("click", async () => {
          const info = await this.codeGrinder.commandGet(assignment.id);
          this.problemSetHandler(info);
        })
      }
    })
    this.buttonProblems.addEventListener("click", () => {
      this.problemsList.style.display = "block";
    })
    document.addEventListener("click", event => {
      if (event.target !== this.buttonProblems) {
        this.problemsList.style.display = "none";
      }
      if (event.target !== this.buttonAssignments) {
        this.assignmentsList.style.display = "none";
      }
    })
    this.#updateAuthenticationStatus();
  }
  async #updateAuthenticationStatus() {
    const user = await this.me;
    if (!user) {
      this.buttonAuthenticator.innerText = "Login";
    } else {
      this.buttonAuthenticator.innerText = "Logout";
    }
    this.buttonAssignments.disabled = !Boolean(user);
    this.buttonProblems.disabled = !Boolean(user);
    this.buttonRunTests.disabled = !Boolean(user);
    this.buttonGrade.disabled = !Boolean(user);
    this.buttonSync.disabled = !Boolean(user);
  }
}
export { CodeGrinder, CodeGrinderUI }