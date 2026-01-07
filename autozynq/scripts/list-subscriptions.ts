import { getWorkflowSubscriptions } from "@/lib/triggers/subscriptions";

async function main() {
  const subs = await getWorkflowSubscriptions("cmk49soa00003lgth1hls37ic");
  console.log(JSON.stringify(subs, null, 2));
}

main().catch((e)=>{console.error(e); process.exit(1);});
