const types={'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','application/pdf':'pdf','text/plain':'txt'};
function valid(files){return Array.isArray(files)&&files.length<=8&&files.every(f=>f&&typeof f.name==='string'&&f.name.length>0&&f.name.length<=180&&!/[\x00-\x1f/\\]/.test(f.name)&&types[f.type]&&Number.isSafeInteger(f.size)&&f.size>0&&f.size<=100*1024*1024)&&files.reduce((n,f)=>n+f.size,0)<=300*1024*1024;}
function signature(b,type){
 if(['video/mp4','video/quicktime','audio/mp4'].includes(type))return b.length>12&&b.subarray(4,8).toString()==='ftyp';
 if(type==='video/webm')return b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
 if(type==='image/jpeg')return b[0]===255&&b[1]===216;
 if(type==='image/png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(type==='image/webp')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
 if(type==='audio/wav'||type==='audio/x-wav')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WAVE';
 if(type==='audio/mpeg')return b.subarray(0,3).toString()==='ID3'||b[0]===255&&(b[1]&224)===224;
 if(type==='application/pdf')return b.subarray(0,5).toString()==='%PDF-';
 return type==='text/plain'&&!b.includes(0);
}
async function verify(db,bucket,file){
 const dir=file.path.slice(0,file.path.lastIndexOf('/')),name=file.path.split('/').pop();
 const listed=await db.storage.from(bucket).list(dir,{search:name,limit:10});
 const found=listed.data?.find(f=>f.name===name);
 if(listed.error||Number(found?.metadata?.size)!==file.size)return false;
 const signed=await db.storage.from(bucket).createSignedUrl(file.path,60);
 if(signed.error||!signed.data?.signedUrl)return false;
 // Read only a bounded header, even when the object server ignores Range.
 const response=await fetch(signed.data.signedUrl,{headers:{Range:'bytes=0-511'},signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.body)return false;
 const reader=response.body.getReader();let chunks=[],size=0;
 try{while(size<512){const x=await reader.read();if(x.done)break;const part=Buffer.from(x.value).subarray(0,512-size);chunks.push(part);size+=part.length;}}finally{await reader.cancel();}
 return signature(Buffer.concat(chunks),file.type);
}
module.exports={types,valid,signature,verify};

