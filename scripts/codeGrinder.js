class CodeGrinder {  // getUsers(){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/users/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });        
  //     return usersJSON;
  // };
  // getUser(){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/users/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return JSON.parse(data[0])
  //     // });
  //     return usersJSON[0];
  // };
  // getProblemSets(){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_sets/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     return problem_sets_JSON;
  // };
  // getProblemSet(id){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_sets/'+id)
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     problem_sets_JSON.forEach((item)=>{
  //         if(item.id== id){
  //             return item;
  //         }
  //     });
  // };
  // getProblemTypes(){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_types/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     return problem_types_JSON;
  // };
  // getProblemType(typeName){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_types/'+typeName)
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });

  //     problem_sets_JSON.forEach((item)=>{
  //         if(item.name== typeName){
  //             return item;
  //         }
  //     });
  // };
  // getProblems(problemSetId){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_set/'+problemSetId+'/problems/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     return problems_JSON;
  // };
  // getProblem(problemSetId,id){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problem_set/'+problemSetId+'/problems/'+id)
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     problem_sets_JSON.forEach((item)=>{
  //         if(item.id== id){
  //             return item;
  //         }
  //     });
  // };
  // getProblemSteps(id){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problems/'+id+'/steps/')
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return data
  //     // });
  //     return problem_steps_JSON;
  // };
  // getAProblemStep(problemId,stepId){
  //     // fetch('https://codegrinder.cs.dixie.edu/v2/problems/'+problemId+'/steps/'+stepId)
  //     // .then(response => response.json())
  //     // .then(data => {
  //     //     return JSON.parse(data)
  //     // });
  //     problem_steps_JSON.forEach((item)=>{
  //         if(item.problemID== problemId && item.step== stepId ){
  //             return item;
  //         }
  //     });
  // };

  getProblemStepFiles(problem_id, step_id) {
    let files = {};
    problem_steps.forEach((item) => {
      if (item["problemID"] == problem_id && item["step"] == step_id) {
        files = item["files"];
      }
    })
    return files;
  }

  getProblemTypeFiles(problem_type_name) {
    let files = {};
    problem_types.forEach((item) => {
      if (item["name"] === problem_type_name) {
        files = item["files"];
      }
    })
    return files;
  }

  getExamFiles(problem_id, step_id, problem_type_name) {
    let files = [];
    let step_files = this.getProblemStepFiles(problem_id, step_id);
    let type_files = this.getProblemTypeFiles(problem_type_name);
    for (let key in step_files) {
      let file = {};
      let value = atob(step_files[key])
      file["filename"] = key;
      file["filecontent"] = value;
      // this.pyodide.fs().Pyodide.createFile()
      files.push(file);
    }
    for (let key in type_files) {
      let file = {};
      let value = atob(type_files[key])
      file["filename"] = key;
      file["filecontent"] = value;
      files.push(file);
    }
    return files;
  }
}
export { CodeGrinder }