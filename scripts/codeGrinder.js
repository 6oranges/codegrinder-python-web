// Hacky trampoline to get around cors
// TODO: ask Russ to fix
// blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource
function trampoline(url,options){
  return fetch("/trampoline",{
    method:"POST",
    body:JSON.stringify({url,options}),
    headers: {
      'Content-Type': "application/json"
    },
  })
}
class CodeGrinder {
  constructor (cookie,host="https://codegrinder.cs.utahtech.edu"){
    this.host=host;
    this.cookie = cookie
  }
  #cookied(url,options){
    if (!options){
      options={};
    }
    if (!options.headers){
      options.headers={};
    }
    options.headers.Cookie=this.cookie;
    return trampoline(url,options);
  }
  async #getObject(path){
    const response = await this.#cookied(this.host+"/v2"+path);
    if (response.status!==200){
      const text = await response.text();
      console.error(text);
      return null;
    } else{
      const json = await response.json();
      console.log(json);
      return json;
    }
  }
  async login(key){
    const json = await this.#getObject("/users/session?key="+key);
    if (json){
      this.cookie=json.cookie
    }
    return json;
  }
  // Use this to determine if the user is logged in.
  getMe() {
    return this.#getObject("/users/me");
  }
  getUserAssignments(id){
    return this.#getObject("/users/"+id+"/assignments");
  }
  getAssignment(id){
    return this.#getObject("/assignments/"+id);
  }
  getProblemSets(){
    return this.#getObject("/problem_sets");
  }
  getProblemSet(id){
    return this.#getObject("/problem_sets/"+id);
  }
  getProblemTypes(){
    return this.#getObject("/problem_types");
  }
  getProblemType(typeName){
    return this.#getObject("/problem_types/"+typeName);
  }
  getProblemSetProblems(id){
    return this.#getObject("/problem_sets/"+id+"/problems");
  }
  getProblemSetProblem(problemSetId,id){
    return this.#getObject("/problem_sets/"+problemSetId+"/problems/"+id);
  }
  getProblemSteps(id){
    return this.#getObject("/problems/"+id+"/steps");
  }
  getProblemStep(problemId,step){
    return this.#getObject("/problems/"+problemId+'/steps/'+step);
  }
  getProblem(id){
    return this.#getObject("/problems/"+id);
  }
  getCourse(id){
    return this.#getObject("/courses/"+id);
  }
  getLastCommit(assignmentId,problemId){
    return this.#getObject("/assignments/"+assignmentId+"/problems/"+problemId+"/commits/last");
  }
  async commandGet(assignmentId){
    const assignment = await this.getAssignment(assignmentId)
    const course = await this.getCourse(assignment.courseID);
    const problemSet = await this.getProblemSet(assignment.problemSetID);
    const problemSetProblems = await this.getProblemSetProblems(assignment.problemSetID)
    const commits ={};
    const infos = {};
    const problems = {};
    const steps = {};
    const types= {};
    for (let elt of problemSetProblems) {
      const problem=await this.getProblem(elt.problemID);
      problems[problem.unique]=problem;
      const info={};
      const commit=await this.getLastCommit(assignment.id,problem.id);
      info.id=problem.id;
      if (commit){
        info.step=commit.step;
      } else {
        info.step = 1;
      }
      const step = await this.getProblemStep(problem.id,info.step);
      infos[problem.unique] = info;
      commits[problem.unique] = commit;
      steps[problem.unique] = step;
      if (step.problemType !== "python3unittest"){
        console.warning("We only support python3unittest not ",step.problemType)
      }
      if (!(step.problemType in types)){
        types[step.problemType]= await this.getProblemType(step.problemType);
      }
    }
    console.log(commits,infos,problems,steps,types);
  }
}
export { CodeGrinder }