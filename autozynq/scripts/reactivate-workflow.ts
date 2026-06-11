import { deactivateWorkflow, activateWorkflow } from "@/lib/workflow/activation";

async function main(){
  const id = "cmk49soa00003lgth1hls37ic";
  const de = await deactivateWorkflow(id);
  console.log("Deactivated:", de);
  const ac = await activateWorkflow(id);
  console.log("Activated:", ac);
}

main().catch(e=>{console.error(e); process.exit(1);});
