using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
namespace BestSnsBridge {
 public static class OutputVerifier {
  public static string FindEncoder(){
   foreach(var folder in (Environment.GetEnvironmentVariable("PATH")??"").Split(';')){try{var p=Path.Combine(folder.Trim('"'),"ffmpeg.exe");if(File.Exists(p)&&File.Exists(Path.Combine(Path.GetDirectoryName(p),"ffprobe.exe")))return Path.GetFullPath(p);}catch{}}
   var root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Pixeling","releases");
   if(Directory.Exists(root))foreach(var dir in Directory.GetDirectories(root).Where(d=>!d.EndsWith(".staging")).OrderByDescending(d=>d)){var p=Path.Combine(dir,"app","tools","media","ffmpeg.exe");if(File.Exists(p)&&File.Exists(Path.Combine(Path.GetDirectoryName(p),"ffprobe.exe")))return p;}
   throw new Exception("자동 영상 검사를 위한 ffmpeg.exe / ffprobe.exe가 필요합니다.");
  }
  public static void CheckPath(string path){
   if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new Exception("영상 검사 경로가 다른 위치로 연결되어 있습니다.");
   for(var d=new DirectoryInfo(Path.GetDirectoryName(path));d!=null;d=d.Parent)if((d.Attributes&FileAttributes.ReparsePoint)!=0)throw new Exception("영상 검사 폴더가 다른 위치로 연결되어 있습니다.");
  }
  public static Dictionary<string,object> Manifest(string dir,string id,string nonce){
   var path=Path.Combine(dir,"output.ready.json");CheckPath(path);if(new FileInfo(path).Length>8192)throw new Exception("완료 기록 크기 오류");
   var m=Data.Obj(Data.Json.DeserializeObject(File.ReadAllText(path,Encoding.UTF8)));
   if(nonce.Length<32||Data.Text(m,"orderId")!=id||Data.Text(m,"nonce")!=nonce||!m.ContainsKey("done")||!(m["done"] is bool)||!(bool)m["done"]||!System.Text.RegularExpressions.Regex.IsMatch(Data.Text(m,"sha256"),"^[a-f0-9]{64}$"))throw new Exception("완료 기록이 이 주문과 일치하지 않습니다.");return m;
  }
  public static async Task<string> Run(string exe,string args){
   using(var p=new Process{StartInfo=new ProcessStartInfo(exe,args){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true}}){
    p.Start();var stdout=p.StandardOutput.ReadToEndAsync();var stderr=p.StandardError.ReadToEndAsync();var deadline=DateTime.UtcNow.AddMinutes(15);
    while(!p.HasExited){if(DateTime.UtcNow>deadline){p.Kill();throw new Exception("영상 검사 제한 시간을 넘었습니다.");}await Task.Delay(200);}
    var output=await stdout;var error=await stderr;if(p.ExitCode!=0||!String.IsNullOrWhiteSpace(error))throw new Exception("영상 전체 재생 검사에 실패했습니다. 손상된 파일은 전달하지 않습니다.");return output;
   }
  }
  public static void CheckProbe(string json){
   var p=Data.Obj(Data.Json.DeserializeObject(json));double duration;
   if(!double.TryParse(Data.Text(Data.Obj(p["format"]),"duration"),NumberStyles.Float,CultureInfo.InvariantCulture,out duration)||double.IsNaN(duration)||double.IsInfinity(duration)||duration<=0||duration>14400)throw new Exception("영상 길이 검사 실패");
   if(!Data.List(p["streams"]).Select(Data.Obj).Any(s=>Data.Text(s,"codec_type")=="video"&&Convert.ToInt32(s["width"])>0&&Convert.ToInt32(s["height"])>0))throw new Exception("영상 화면 스트림이 없습니다.");
  }
  public static async Task<byte[]> Verify(string dir,string id,string nonce,string encoder){
   var manifest=Manifest(dir,id,nonce);var path=Path.Combine(dir,"final.mp4");CheckPath(path);
   using(var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)){
    if(stream.Length<12||stream.Length>150*1024*1024)throw new Exception("영상 크기 검사 실패");var bytes=new byte[stream.Length];int n=0,r;while(n<bytes.Length&&(r=await stream.ReadAsync(bytes,n,bytes.Length-n))>0)n+=r;
    if(n!=bytes.Length||Encoding.ASCII.GetString(bytes,4,4)!="ftyp"||Data.Sha(bytes)!=Data.Text(manifest,"sha256"))throw new Exception("완료 기록과 실제 영상 파일이 다릅니다.");
    var quoted="\""+path+"\"";
    CheckProbe(await Run(Path.Combine(Path.GetDirectoryName(encoder),"ffprobe.exe"),"-v error -show_entries format=duration:stream=codec_type,width,height -of json "+quoted));
    await Run(encoder,"-v error -xerror -nostdin -i "+quoted+" -map 0:v:0 -map 0:a? -f null -");
    return bytes;
   }
  }
 }
}
