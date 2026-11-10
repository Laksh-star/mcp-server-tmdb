import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {createServer} from "node:http";
import {once} from "node:events";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";
import {localEnvironment} from "./local-environment.mjs";
const run=promisify(execFile);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"tmdb-doctor-test-"));
const marker=path.join(temporary,"must-not-exist");
fs.writeFileSync(path.join(temporary,".env"),`TMDB_API_KEY='literal-$(touch ${marker})'\nTMDB_BASE_URL=http://127.0.0.1:1\nUNRELATED=must-not-load\n`);
fs.writeFileSync(path.join(temporary,".tmdb.env"),"TMDB_API_KEY=fallback-secret\n");
assert.equal(localEnvironment(temporary,{}).env.TMDB_API_KEY,`literal-$(touch ${marker})`);
assert.equal(localEnvironment(temporary,{TMDB_API_KEY:"explicit-secret"}).env.TMDB_API_KEY,"explicit-secret");
assert.equal(localEnvironment(temporary,{}).env.UNRELATED,undefined);
assert.equal(fs.existsSync(marker),false,"Environment files must never execute shell expressions");
let calls=0,status=200,malformed=false;
const fixture=createServer((req,res)=>{calls++;res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(malformed ? {unexpected:true} : {genres:[]}));});
fixture.listen(0,"127.0.0.1");await once(fixture,"listening");
const sentinel="doctor-test-secret-do-not-print";
const env={...process.env,TMDB_API_KEY:sentinel,TMDB_BASE_URL:`http://127.0.0.1:${fixture.address().port}`};
async function report(args,options={}) {
 let output;
 try {output=await run(process.execPath,["scripts/doctor.mjs","--json",...args],{env,...options});}
 catch(error){output=error;}
 assert.ok(!output.stdout.includes(sentinel)&&!output.stderr.includes(sentinel),"Doctor must not print credentials");
 return {data:JSON.parse(output.stdout),code:output.code||0};
}
try{
 const offline=await report([]);assert.equal(offline.data.ok,true);assert.equal(calls,0);
 assert.equal(offline.data.checks.find(x=>x.id==="mcp").status,"pass");
 const online=await report(["--online"]);assert.equal(online.data.checks.find(x=>x.id==="api").status,"pass");assert.equal(calls,1);
 status=401;const rejected=await report(["--online"]);assert.equal(rejected.data.ok,false);assert.equal(rejected.code,1);assert.match(rejected.data.checks.find(x=>x.id==="api").message,/rejected/);
 status=200;malformed=true;const unexpected=await report(["--online"]);assert.equal(unexpected.data.ok,false);assert.match(unexpected.data.checks.find(x=>x.id==="api").message,/unexpected response/);
 const missing=fs.mkdtempSync(path.join(temporary,"empty-"));
 const broken=await report(["--repo",missing],{env:{...env,TMDB_API_KEY:"",TMDB_BASE_URL:""}});
 assert.equal(broken.data.ok,false);assert.equal(broken.data.checks.find(x=>x.id==="build").status,"fail");
 assert.equal(broken.data.checks.find(x=>x.id==="credentials").status,"fail");
 for(const launch of ["node",...(process.platform==="win32"?[]:["shell"])]) {
  const client=new Client({name:"portable-launcher-test",version:"1.0.0"});
  try{
   await client.connect(new StdioClientTransport({command:launch==="node"?process.execPath:"bash",args:[`plugins/tmdb/scripts/run-server.${launch==="node"?"mjs":"sh"}`],env,stderr:"inherit"}));
   assert.ok((await client.listTools()).tools.some(x=>x.name==="plan_streaming_coverage"));
  }finally{await client.close();}
 }
 console.log("Doctor tests passed: non-executing env parsing, precedence, redaction, offline/online diagnosis, broken checkout, and portable/shell MCP launchers.");
}finally{fixture.close();await once(fixture,"close");fs.rmSync(temporary,{recursive:true,force:true});}
