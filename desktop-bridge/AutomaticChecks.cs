using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
namespace BestSnsBridge {
 public static class AutomaticChecks {
  public static async Task Run(){
   int checks=0,starts=0,sends=0;bool ready=false;Action<bool> ok=b=>{if(!b)throw new Exception("Automatic test failed");checks++;};
   var state=new Dictionary<string,object>{{"phase","claimed"}};
   Func<Task> start=()=>{starts++;state["phase"]="submitted";return Task.FromResult(0);};
   Func<Task> send=()=>{sends++;state["phase"]="uploading";return Task.FromResult(0);};
   await AutomaticFlow.Tick(state,start,()=>Task.FromResult(ready),send);ok(starts==1&&sends==0);
   await AutomaticFlow.Tick(state,start,()=>Task.FromResult(ready),send);ok(starts==1&&sends==0);
   ready=true;await AutomaticFlow.Tick(state,start,()=>Task.FromResult(ready),send);ok(starts==1&&sends==1);
   await AutomaticFlow.Tick(state,start,()=>Task.FromResult(ready),send);ok(starts==1&&sends==2);
   foreach(var phase in new[]{"opening","prepared","sending","attention"}){state["phase"]=phase;bool rejected=false;try{await AutomaticFlow.Tick(state,start,()=>Task.FromResult(true),send);}catch{rejected=true;}ok(rejected&&starts==1);}
   var dir=Path.Combine(Path.GetTempPath(),"bestsns-auto-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);var video=Path.Combine(dir,"final.mp4");var marker=Path.Combine(dir,"output.ready.json");var id=Guid.NewGuid().ToString();var nonce=Guid.NewGuid().ToString("N");var exe=OutputVerifier.FindEncoder();
   try{
    await OutputVerifier.Run(exe,"-v error -nostdin -f lavfi -i color=c=blue:s=160x90:r=10 -t 1 -c:v libx264 -pix_fmt yuv420p \""+video+"\"");
    var bytes=File.ReadAllBytes(video);var sha=Data.Sha(bytes);File.WriteAllText(marker,Data.Json.Serialize(new{orderId=id,nonce,done=true,sha256=sha}));
    ok(Data.Sha(await OutputVerifier.Verify(dir,id,nonce,exe))==sha);
    bool wrong=false;try{await OutputVerifier.Verify(dir,Guid.NewGuid().ToString(),nonce,exe);}catch{wrong=true;}ok(wrong);
    wrong=false;try{await OutputVerifier.Verify(dir,id,Guid.NewGuid().ToString("N"),exe);}catch{wrong=true;}ok(wrong);
    File.WriteAllText(video,"0000ftypisomBROKENVIDEO");var corrupt=File.ReadAllBytes(video);
    wrong=false;try{await OutputVerifier.Verify(dir,id,nonce,exe);}catch{wrong=true;}ok(wrong);
    File.WriteAllText(marker,Data.Json.Serialize(new{orderId=id,nonce,done=true,sha256=Data.Sha(corrupt)}));
    wrong=false;try{await OutputVerifier.Verify(dir,id,nonce,exe);}catch{wrong=true;}ok(wrong);
    wrong=false;try{OutputVerifier.CheckProbe("{\"format\":{\"duration\":\"1\"},\"streams\":[{\"codec_type\":\"audio\"}]}");}catch{wrong=true;}ok(wrong);
   }finally{if(File.Exists(video))File.Delete(video);if(File.Exists(marker))File.Delete(marker);Directory.Delete(dir);}
   File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"automatic-tests.txt"),"PASS "+checks+" checks\nAutomatic start, wait, delivery, resume, ambiguous-state rejection, real video decode and corrupt video rejection.\n");
  }
 }
}
