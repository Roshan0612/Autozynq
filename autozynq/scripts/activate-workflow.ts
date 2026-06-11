import { activateWorkflow } from "@/lib/workflow/activation";

async function main(){
  const res = await activateWorkflow("cmk49soa00003lgth1hls37ic");
  console.log(res);
}

main().catch(e=>{console.error(e); process.exit(1);});
