#!/usr/bin/env node
/* stdout carries only binary/JSON results. No source writes or network. */
'use strict';
const fs=require('node:fs'),P=require('../src/packed.js'),I=require('../src/icm.js');
async function main(){
 const [command,input='-']=process.argv.slice(2),b=fs.readFileSync(input==='-'?0:input);
 if(command==='inspect'||command==='inspect-package'){
  const u=command==='inspect'?await P.readUnit(b):await P.readPackage(b);
  process.stdout.write(JSON.stringify({manifest:u.manifest,members:Object.keys(u.members)},null,2)+'\n');
 }else if(command==='workspace'){
  const args=P.parseJSON(b),out=await I.workspace(args.collection,args.plan||I.directPlan(args.collection),{timestamp:args.timestamp});process.stdout.write(out.bytes);
 }else throw new Error('Usage: node tools/packed-cli.cjs inspect|inspect-package|workspace FILE|-');
}
main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
