import fetch from "node-fetch";

async function main() {
  const response = await fetch("http://127.0.0.1:3000/api/webhooks/h213tlc660prkuoi");
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});