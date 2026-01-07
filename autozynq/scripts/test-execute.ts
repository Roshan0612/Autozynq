async function main(){
  const res = await fetch('http://localhost:3000/api/workflows/cmk49soa00003lgth1hls37ic/execute',{
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({})
  });
  const text = await res.text();
  console.log(res.status, text);
}
main().catch(e=>{console.error(e); process.exit(1);});
