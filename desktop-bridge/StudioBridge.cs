using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

namespace BestSnsBridge {
 public static class Data {
  public static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=32*1024*1024 };
  public static string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"BESTSNSStudioBridge");
  public static string Text(IDictionary<string,object> d,string k){return d!=null&&d.ContainsKey(k)&&d[k]!=null?Convert.ToString(d[k]):"";}
  public static Dictionary<string,object> Obj(object o){return o as Dictionary<string,object>??new Dictionary<string,object>();}
  public static IEnumerable<object> List(object o){return o as object[]??(o is System.Collections.ArrayList?((System.Collections.ArrayList)o).ToArray():null)??new object[0];}
  public static string Sha(byte[] b){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
  public static void Save(string path,object data){Directory.CreateDirectory(Path.GetDirectoryName(path));var bytes=ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Serialize(data)),null,DataProtectionScope.CurrentUser);var tmp=path+".tmp";File.WriteAllBytes(tmp,bytes);if(File.Exists(path))File.Replace(tmp,path,null);else File.Move(tmp,path);}
  public static Dictionary<string,object> Read(string path){return File.Exists(path)?Obj(Json.DeserializeObject(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(path),null,DataProtectionScope.CurrentUser)))):new Dictionary<string,object>();}
  public static string JobDirectory(string id){Guid g;if(!Guid.TryParseExact(id,"D",out g))throw new Exception("잘못된 주문 번호입니다.");return Path.Combine(Root,"jobs",g.ToString());}
  public static Uri Site(string value){Uri u;if(!Uri.TryCreate(value,UriKind.Absolute,out u)||u.Scheme!="https"||u.Port!=443||u.UserInfo!=""||u.AbsolutePath!="/"||u.Query!=""||u.Fragment!=""||!new[]{"www.bestsns.com","bestsns.com","deploy-preview-562--bestsns.netlify.app"}.Contains(u.Host))throw new Exception("BESTSNS 운영 주소 또는 PR 562 미리보기 주소만 연결할 수 있습니다.");return u;}
 }
 public sealed class ApiFailure:Exception { public readonly int Status;public ApiFailure(int status):base("사이트 응답 오류 ("+status+")"){Status=status;} }
 public sealed class BridgeApi:IDisposable {
  readonly HttpClient http;readonly Uri endpoint;
  public BridgeApi(string site,string token){endpoint=new Uri(Data.Site(site),"/.netlify/functions/content-desktop-worker");if(!System.Text.RegularExpressions.Regex.IsMatch(token,@"^desktop_[a-f0-9-]{36}\.[a-f0-9]{64}$"))throw new Exception("운영자 화면에서 발급한 PC 연결키를 입력하세요.");http=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false});http.Timeout=TimeSpan.FromMinutes(4);http.DefaultRequestHeaders.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",token);}
  public async Task<Dictionary<string,object>> Call(object body=null){using(var request=new HttpRequestMessage(body==null?HttpMethod.Get:HttpMethod.Post,endpoint)){if(body!=null)request.Content=new StringContent(Data.Json.Serialize(body),Encoding.UTF8,"application/json");using(var r=await http.SendAsync(request)){var text=await r.Content.ReadAsStringAsync();if(!r.IsSuccessStatusCode)throw new ApiFailure((int)r.StatusCode);return Data.Obj(Data.Json.DeserializeObject(text));}}}
  public void Dispose(){http.Dispose();}
  public static async Task Download(string url,string path,long expected=0){var uri=new Uri(url);if(uri.Scheme!="https"||uri.UserInfo!="")throw new Exception("파일 주소가 올바르지 않습니다.");using(var http=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false})){http.Timeout=TimeSpan.FromMinutes(5);using(var response=await http.GetAsync(uri,HttpCompletionOption.ResponseHeadersRead)){response.EnsureSuccessStatusCode();if(response.Content.Headers.ContentLength>150*1024*1024)throw new Exception("파일이 너무 큽니다.");using(var input=await response.Content.ReadAsStreamAsync())using(var output=File.Create(path+".part")){byte[] b=new byte[65536];long total=0;int n;while((n=await input.ReadAsync(b,0,b.Length))>0){total+=n;if(total>150*1024*1024)throw new Exception("파일이 너무 큽니다.");await output.WriteAsync(b,0,n);}if(expected>0&&total!=expected)throw new Exception("첨부파일 크기가 일치하지 않습니다.");}if(File.Exists(path))File.Delete(path);File.Move(path+".part",path);}}}
  public static async Task Upload(string url,byte[] bytes){var uri=new Uri(url);if(uri.Scheme!="https"||uri.UserInfo!="")throw new Exception("업로드 주소 오류");using(var http=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false})){http.Timeout=TimeSpan.FromMinutes(5);using(var body=new ByteArrayContent(bytes)){body.Headers.ContentType=new System.Net.Http.Headers.MediaTypeHeaderValue("video/mp4");using(var r=await http.PutAsync(uri,body))r.EnsureSuccessStatusCode();}}}
 }
 public sealed class PixelingDriver {
  readonly string library;readonly string processRoot;
  public PixelingDriver(string libraryPath){library=Path.GetFullPath(libraryPath);processRoot=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Pixeling")+Path.DirectorySeparatorChar;}
  public Dictionary<string,object> Library(){using(var stream=new FileStream(library,FileMode.Open,FileAccess.Read,FileShare.ReadWrite))using(var reader=new StreamReader(stream,Encoding.UTF8))return Data.Obj(Data.Json.DeserializeObject(reader.ReadToEnd()));}
  public Dictionary<string,object> VerifyPreset(string id,int version){var saved=Data.List(Library()["saved"]).Select(Data.Obj).Where(p=>Data.Text(p,"saved_id")==id).ToArray();if(saved.Length!=1)throw new Exception("프리셋 ID를 하나로 확인할 수 없습니다. 동기화 또는 운영자 확인이 필요합니다.");var p0=saved[0];var shared=Data.Obj(p0.ContainsKey("shared_reference")?p0["shared_reference"]:null);if(Convert.ToInt32(p0["saved_version"])!=version||shared.Count==0||Convert.ToInt32(shared["version"])!=version||(shared.ContainsKey("retired")&&Convert.ToBoolean(shared["retired"])))throw new Exception("프리셋 버전 또는 공개 프리셋 상태가 다릅니다.");return p0;}
  public AutomationElement Window(){var matches=new List<AutomationElement>();foreach(AutomationElement e in AutomationElement.RootElement.FindAll(TreeScope.Children,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Window))){try{if(e.Current.Name!="Pixeling Desktop")continue;var p=Process.GetProcessById(e.Current.ProcessId);var exe=Path.GetFullPath(p.MainModule.FileName);if(exe.StartsWith(processRoot,StringComparison.OrdinalIgnoreCase))matches.Add(e);}catch{}}if(matches.Count!=1)throw new Exception("픽셀링 창이 정확히 하나 열려 있어야 합니다. 최소화되어 있다면 열어 주세요.");return matches[0];}
  public AutomationElement Unique(ControlType type,string name){var window=Window();var c=new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,type),new PropertyCondition(AutomationElement.NameProperty,name));var all=window.FindAll(TreeScope.Descendants,c).Cast<AutomationElement>().Where(e=>e.Current.IsEnabled&&!e.Current.IsOffscreen).ToArray();if(all.Length!=1)throw new Exception("화면 요소를 확실히 찾지 못했습니다: "+name+" ("+all.Length+"). 좌표로 대신 클릭하지 않습니다.");return all[0];}
  public void Click(string name){var e=Unique(ControlType.Button,name);object pattern;if(!e.TryGetCurrentPattern(InvokePattern.Pattern,out pattern))throw new Exception("버튼의 의미 기반 실행 기능이 없습니다: "+name);((InvokePattern)pattern).Invoke();}
  public void Fill(string name,string value){var e=Unique(ControlType.Edit,name);object pattern;if(!e.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)||((ValuePattern)pattern).Current.IsReadOnly)throw new Exception("입력창의 안전한 값 설정 기능을 확인할 수 없습니다: "+name);((ValuePattern)pattern).SetValue(value);if(((ValuePattern)pattern).Current.Value!=value)throw new Exception("입력한 원문을 확인하지 못했습니다.");}
  public string Route(){var roots=Window().FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Document));var routes=new List<string>();foreach(AutomationElement e in roots){object p;string value="";if(e.TryGetCurrentPattern(ValuePattern.Pattern,out p))value=((ValuePattern)p).Current.Value;if(value!=null&&value.StartsWith("http://localhost:")&&value.Contains("/__pixagent_app/index.html#"))routes.Add(value);}if(routes.Count!=1)throw new Exception("현재 픽셀링 대화 주소를 확인하지 못했습니다.");return routes[0];}
  public string Diagnostic(){var win=Window();var rows=win.FindAll(TreeScope.Descendants,new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button)));var result=new List<string>();foreach(AutomationElement e in rows){if(e.Current.IsOffscreen)continue;var name=e.Current.Name;if(name.Length>150)continue;object p;result.Add(e.Current.ControlType.ProgrammaticName+" | "+name+" | "+(e.TryGetCurrentPattern(InvokePattern.Pattern,out p)?"Invoke ":"")+(e.TryGetCurrentPattern(ValuePattern.Pattern,out p)?"Value":""));}return String.Join(Environment.NewLine,result);}
  public Dictionary<string,object> Threads(){var lib=Library();return Data.Obj(lib["threads"]);}
  public string NewBoundThread(HashSet<string> before,string presetId,int version){var now=Threads();var added=now.Keys.Where(k=>!before.Contains(k)).ToArray();if(added.Length!=1)throw new Exception("새 대화를 주문에 정확히 연결하지 못했습니다. 자동 재실행하지 마세요.");var row=Data.Obj(now[added[0]]);if(Data.Text(row,"saved_id")!=presetId||Convert.ToInt32(VerifyPreset(presetId,version)["saved_version"])!=version)throw new Exception("새 대화에 적용된 프리셋을 검증하지 못했습니다.");return added[0];}
 }
 public sealed class BridgeForm:Form {
  readonly TextBox site=new TextBox(),key=new TextBox(),library=new TextBox(),log=new TextBox(),order=new TextBox();
  readonly Button connect=new Button(),pause=new Button(),diagnose=new Button();
  readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
  BridgeApi api;Dictionary<string,object> job,state;bool busy,watching,unreadable;Func<Task> retryAction;int retries;DateTime retryAfter=DateTime.MinValue;string encoder;readonly string settingsPath=Path.Combine(Data.Root,"settings.bin"),statePath=Path.Combine(Data.Root,"active.bin");
  public BridgeForm(){Text="BESTSNS 제작 연결 · 자동화 검증판 0.2";Width=900;Height=760;MinimumSize=new Size(760,650);Font=new Font("맑은 고딕",10);StartPosition=FormStartPosition.CenterScreen;
   var panel=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=10,Padding=new Padding(18)};panel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,125));panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));Controls.Add(panel);
   AddRow(panel,"사이트 주소",site,0);AddRow(panel,"PC 연결키",key,1);key.UseSystemPasswordChar=true;AddRow(panel,"프리셋 목록 파일",library,2);
   site.Text="https://deploy-preview-562--bestsns.netlify.app/";library.Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Pixeling","state","preset_engine","data","native_preset_library.json");
   var buttons=new FlowLayoutPanel{AutoSize=true,Dock=DockStyle.Fill};foreach(var b in new[]{connect,diagnose,pause}){b.AutoSize=true;buttons.Controls.Add(b);}connect.Text="연결 / 자동 처리 시작";diagnose.Text="픽셀링 구조 진단";pause.Text="자동 처리 일시정지";panel.Controls.Add(buttons,0,3);panel.SetColumnSpan(buttons,2);
   var help=new Label{Text="주문 수신 → 자동 제작 → 파일 검증 → 자동 전달 · 한 번에 1건\n주문별 확인 버튼 없이 처리합니다. 일시정지는 픽셀링의 이미 시작된 제작을 취소하지 않습니다.",AutoSize=true,Dock=DockStyle.Fill};panel.Controls.Add(help,0,4);panel.SetColumnSpan(help,2);
   order.Multiline=true;order.ReadOnly=true;order.ScrollBars=ScrollBars.Vertical;order.Dock=DockStyle.Fill;panel.Controls.Add(order,0,5);panel.SetColumnSpan(order,2);panel.RowStyles.Clear();for(int i=0;i<5;i++)panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));panel.RowStyles.Add(new RowStyle(SizeType.Percent,45));
   log.Multiline=true;log.ReadOnly=true;log.ScrollBars=ScrollBars.Vertical;log.Dock=DockStyle.Fill;panel.Controls.Add(log,0,6);panel.SetColumnSpan(log,2);panel.RowStyles.Add(new RowStyle(SizeType.Percent,55));
   connect.Click+=async(s,e)=>await Guard(Connect);diagnose.Click+=async(s,e)=>await Guard(Diagnose);
   pause.Click+=(s,e)=>{watching=false;timer.Stop();var config=Data.Read(settingsPath);config["automatic"]=false;Data.Save(settingsPath,config);Note("자동 처리를 일시정지했습니다. 이미 시작된 제작은 재전송하지 않습니다.");};
   timer.Interval=20000;timer.Tick+=async(s,e)=>{if(watching&&!busy&&DateTime.UtcNow>=retryAfter)await Guard(retryAction??Poll);};FormClosing+=(s,e)=>{if(busy){e.Cancel=true;Note("현재 자동 전송/검사가 끝난 후 닫을 수 있습니다.");}else timer.Stop();};
   try{var settings=Data.Read(settingsPath);if(settings.Count>0){site.Text=Data.Text(settings,"site");key.Text=Data.Text(settings,"token");library.Text=Data.Text(settings,"library");if(settings.ContainsKey("automatic")&&Convert.ToBoolean(settings["automatic"]))Shown+=async(s,e)=>await Guard(Connect);}state=Data.Read(statePath);if(state.Count>0){job=Data.Obj(state["job"]);ShowJob();Note("이전 작업을 복원했습니다. 연결 후 완료 감시를 이어가며 이미 보낸 요청은 재전송하지 않습니다.");}}catch{unreadable=true;Note("저장된 설정을 읽지 못했습니다. 같은 Windows 계정에서 실행하세요.");}
  }
  void AddRow(TableLayoutPanel p,string label,TextBox input,int row){p.Controls.Add(new Label{Text=label,AutoSize=true,Anchor=AnchorStyles.Left},0,row);input.Dock=DockStyle.Fill;p.Controls.Add(input,1,row);}
  void Note(string msg){log.AppendText(DateTime.Now.ToString("HH:mm:ss")+"  "+msg+Environment.NewLine);}
  async Task Guard(Func<Task> action){
   if(busy)return;busy=true;bool attention=false;connect.Enabled=diagnose.Enabled=false;
   try{
    try{await action();retries=0;retryAction=null;retryAfter=DateTime.MinValue;}catch(Exception ex){
     Note(ex.Message);var apiError=ex as ApiFailure;var transient=ex is HttpRequestException||ex is TaskCanceledException||(apiError!=null&&(apiError.Status>=500||apiError.Status==429));
     if(transient&&++retries<=5){retryAction=action;if(watching)timer.Start();retryAfter=DateTime.UtcNow.AddSeconds(Math.Min(300,20*Math.Pow(2,retries-1)));Note("통신을 자동 재시도합니다. 제작 요청은 다시 보내지 않습니다.");}
     else{watching=false;timer.Stop();if(job!=null&&state!=null){state["phase"]="attention";Data.Save(statePath,state);attention=true;}}
    }
    if(attention&&api!=null){try{await api.Call(new{action="stage",id=Data.Text(job,"id"),stage="attention"});}catch{Note("작업 중단 상태를 서버에 전송하지 못했습니다.");}}
   }finally{busy=false;connect.Enabled=diagnose.Enabled=true;}
  }
  void ShowJob(){order.Text="주문: "+Data.Text(job,"id")+Environment.NewLine+"프리셋: "+Data.Text(job,"presetName")+" · v"+Data.Text(job,"presetVersion")+Environment.NewLine+Environment.NewLine+Data.Text(job,"message");}
  async Task Connect(){if(unreadable)throw new Exception("저장된 작업 기록을 복원할 수 없어 자동 시작하지 않습니다.");watching=true;encoder=OutputVerifier.FindEncoder();if(api!=null)api.Dispose();api=new BridgeApi(site.Text.Trim(),key.Text.Trim());var d=await api.Call();Data.Save(settingsPath,new{site=site.Text.Trim(),token=key.Text.Trim(),library=library.Text.Trim(),automatic=true});Note("PC 연결 확인: "+Data.Text(d,"name"));if(job!=null){var remote=await api.Call(new{action="job",id=Data.Text(job,"id")});var latest=Data.Obj(remote["job"]);if(Data.Text(latest,"state")=="completed"){Note("서버에서 이미 전달 완료된 주문입니다.");Data.Save(statePath,new{});job=null;state=null;order.Clear();}else{if(Data.Text(latest,"message")!=Data.Text(job,"message")||Data.Text(latest,"presetId")!=Data.Text(job,"presetId"))throw new Exception("저장된 주문과 서버 주문이 다릅니다.");job=latest;state["job"]=job;Data.Save(statePath,state);ShowJob();}}watching=true;retryAfter=DateTime.MinValue;timer.Start();await Poll();}
  async Task Poll(){
   if(api==null)return;
   var heartbeat=await api.Call();if(!heartbeat.ContainsKey("enabled")||!Convert.ToBoolean(heartbeat["enabled"]))throw new Exception("사이트에서 PC 작업자가 비활성화되어 있습니다.");
   if(job==null){var response=await api.Call(new{action="claim"});if(response["job"]==null)return;job=Data.Obj(response["job"]);
    // Without a durable local record even a remotely claimed job may have been sent before a disk failure.
    if(Data.Text(job,"stage")!="claimed")throw new Exception("로컬 기록이 없는 진행 중 주문입니다. 재전송하지 않습니다.");
    state=new Dictionary<string,object>{{"job",job},{"phase","claimed"},{"threadId",""},{"nonce",Guid.NewGuid().ToString("N")},{"startedAt",DateTime.UtcNow.ToString("o")}};Data.Save(statePath,state);ShowJob();Note("새 주문의 자동 제작을 시작합니다.");
   }
   await AutomaticFlow.Tick(state,Prepare,Ready,Deliver);
  }
  async Task<bool> Ready(){
   var id=Data.Text(job,"id");var thread=Data.Text(state,"threadId");
   if(String.IsNullOrEmpty(thread)||String.IsNullOrEmpty(Data.Text(state,"nonce")))throw new Exception("자동 전달에 필요한 주문 연결 기록이 없습니다.");
   await api.Call(new{action="stage",id,stage="submitted",threadId=thread});
   DateTime started;if(!DateTime.TryParse(Data.Text(state,"startedAt"),null,System.Globalization.DateTimeStyles.RoundtripKind,out started)||DateTime.UtcNow-started.ToUniversalTime()>TimeSpan.FromHours(4))throw new Exception("제작 제한 시간(4시간)을 넘었습니다. 자동 재제작하지 않습니다.");
   var driver=new PixelingDriver(library.Text.Trim());var threads=driver.Threads();if(!threads.ContainsKey(thread)||Data.Text(Data.Obj(threads[thread]),"saved_id")!=Data.Text(job,"presetId"))throw new Exception("주문에 연결된 제작 대화를 확인할 수 없습니다.");
   var dir=Data.JobDirectory(id);var path=Path.Combine(dir,"final.mp4");var marker=Path.Combine(dir,"output.ready.json");
   if(!File.Exists(path)||!File.Exists(marker))return false;
   OutputVerifier.Manifest(dir,id,Data.Text(state,"nonce"));
   var info=new FileInfo(path);var signature=info.Length+":"+info.LastWriteTimeUtc.Ticks;
   if(Data.Text(state,"fileSignature")!=signature){state["fileSignature"]=signature;state["stableSince"]=DateTime.UtcNow.ToString("o");Data.Save(statePath,state);return false;}
   DateTime stable;if(!DateTime.TryParse(Data.Text(state,"stableSince"),null,System.Globalization.DateTimeStyles.RoundtripKind,out stable)||DateTime.UtcNow-stable.ToUniversalTime()<TimeSpan.FromSeconds(20))return false;
   return true;
  }
  Task Diagnose(){var driver=new PixelingDriver(library.Text.Trim());Note(driver.Diagnostic());return Task.FromResult(0);}
  static async Task WaitFor(Func<AutomationElement> find){var until=DateTime.UtcNow.AddSeconds(20);while(DateTime.UtcNow<until){try{find();return;}catch{}await Task.Delay(400);}throw new Exception("화면 구조가 예상과 다릅니다. 자동 클릭을 중단했습니다.");}
  async Task Prepare(){if(job==null||Data.Text(state,"phase")!="claimed")throw new Exception("이미 시작했거나 확인이 필요한 주문입니다.");
   if(String.IsNullOrEmpty(Data.Text(state,"nonce"))){state["nonce"]=Guid.NewGuid().ToString("N");state["startedAt"]=DateTime.UtcNow.ToString("o");Data.Save(statePath,state);}
   var fresh=await api.Call(new{action="job",id=Data.Text(job,"id")});var refreshed=Data.Obj(fresh["job"]);if(Data.Text(refreshed,"state")!="working"||Data.Text(refreshed,"stage")!="claimed"||Data.Text(refreshed,"message")!=Data.Text(job,"message")||Data.Text(refreshed,"presetId")!=Data.Text(job,"presetId"))throw new Exception("제작 시작 전 주문 상태가 달라졌습니다.");job=refreshed;state["job"]=job;Data.Save(statePath,state);
   var id=Data.Text(job,"id");var dir=Data.JobDirectory(id);Directory.CreateDirectory(dir);if(File.Exists(Path.Combine(dir,"final.mp4"))||File.Exists(Path.Combine(dir,"output.ready.json")))throw new Exception("이미 결과 파일이 있는 주문은 다시 제작하지 않습니다.");var driver=new PixelingDriver(library.Text.Trim());var preset=driver.VerifyPreset(Data.Text(job,"presetId"),Convert.ToInt32(job["presetVersion"]));if(Data.Text(preset,"name")!=Data.Text(job,"presetName"))throw new Exception("프리셋 ID에 연결된 이름이 다릅니다. 업데이트를 확인하세요.");
   var paths=new List<string>();int count=0;foreach(var value in Data.List(job.ContainsKey("attachments")?job["attachments"]:null)){if(++count>8)throw new Exception("첨부 개수 초과");var f=Data.Obj(value);var extensions=new Dictionary<string,string>{{"video/mp4","mp4"},{"video/quicktime","mov"},{"video/webm","webm"},{"image/jpeg","jpg"},{"image/png","png"},{"image/webp","webp"},{"audio/mpeg","mp3"},{"audio/wav","wav"},{"audio/x-wav","wav"},{"audio/mp4","m4a"},{"application/pdf","pdf"},{"text/plain","txt"}};string ext;if(!extensions.TryGetValue(Data.Text(f,"type"),out ext))throw new Exception("지원되지 않는 첨부 형식");var path=Path.Combine(dir,"input-"+count+"."+ext);await BridgeApi.Download(Data.Text(f,"url"),path,Convert.ToInt64(f["size"]));paths.Add(path);}
   foreach(var value in Data.List(job.ContainsKey("references")?job["references"]:null)){var f=Data.Obj(value);if(++count>38)throw new Exception("참고 영상 개수 초과");var path=Path.Combine(dir,"reference-"+count+".mp4");await BridgeApi.Download(Data.Text(f,"url"),path);paths.Add(path);}
   // Persist before every side effect. A crash after this point must NEVER resend automatically.
   var before=new HashSet<string>(driver.Threads().Keys);state["priorThreads"]=before.ToArray();state["phase"]="opening";Data.Save(statePath,state);await api.Call(new{action="stage",id,stage="prepared"});
   driver.Click("프리셋");await WaitFor(()=>driver.Unique(ControlType.Edit,"프리셋 이름 또는 태그 검색"));driver.Fill("프리셋 이름 또는 태그 검색",Data.Text(job,"presetName"));
   await WaitFor(()=>driver.Unique(ControlType.Button,Data.Text(job,"presetName")+" 자세히 보기"));driver.Click(Data.Text(job,"presetName")+" 자세히 보기");
   await WaitFor(()=>driver.Unique(ControlType.Button,Data.Text(job,"presetName")+" · 버전 "+Data.Text(job,"presetVersion")+" · 새 채팅에 사용"));
   driver.Click(Data.Text(job,"presetName")+" · 버전 "+Data.Text(job,"presetVersion")+" · 새 채팅에 사용");
   await WaitFor(()=>driver.Unique(ControlType.Edit,"메시지"));
   driver.Unique(ControlType.Button,Data.Text(job,"presetName")+" 프리셋 미리보기");
   state["route"]=driver.Route();state["phase"]="prepared";state["priorThreads"]=before.ToArray();Data.Save(statePath,state);
   var history=String.Join("\n",Data.List(job.ContainsKey("references")?job["references"]:null).Select(v=>Data.Text(Data.Obj(v),"text")));var output=Path.Combine(dir,"final.mp4");var prompt="[BESTSNS 제작 주문 "+id+"]\n고객 요청 원문:\n"+Data.Text(job,"message")+"\n\n이전 제작 요청 (최신 수정 요청을 우선 적용):\n"+history+"\n\n운영자 제작 지침:\n"+Data.Text(job,"privateInstructions")+"\n\n이번 주문 전용 첨부/참고 파일:\n"+String.Join("\n",paths)+"\n\n완성 MP4를 다음 주문 전용 경로에 저장하세요: "+output+"\n중간 작업물이 아닌 최종 완성본만 이 이름으로 저장하세요. 다른 대화의 파일은 사용하지 마세요. 완료 시 이 절대 경로를 대화에 표시하세요.";
   prompt+="\n\n자동 완료 전달 규칙: 모든 편집과 렌더링이 성공한 뒤 final.mp4를 닫고 실제 파일의 SHA-256을 계산하세요. 마지막으로 "+Path.Combine(dir,"output.ready.json")+" 파일을 임시 파일에서 이름 변경하는 방식으로 저장하세요. JSON 내용: "+Data.Json.Serialize(new{orderId=id,nonce=Data.Text(state,"nonce"),done=true,sha256="실제 final.mp4의 SHA-256 소문자 64자리"})+". 실패하거나 미완성인 경우 완료 기록을 만들지 마세요. 완료 기록을 저장한 뒤에는 final.mp4를 수정하지 마세요.";
   // Only known, explicitly named editable controls are supported; unknown layouts fail closed.
   driver.Fill("메시지",prompt);if(driver.Route()!=Data.Text(state,"route"))throw new Exception("현재 대화가 변경되었습니다.");
   state["phase"]="sending";Data.Save(statePath,state);driver.Click("보내기");
   string thread=null;var until=DateTime.UtcNow.AddSeconds(45);while(DateTime.UtcNow<until){try{thread=driver.NewBoundThread(before,Data.Text(job,"presetId"),Convert.ToInt32(job["presetVersion"]));break;}catch{}await Task.Delay(500);}
   if(thread==null)throw new Exception("전송 후 프리셋과 새 대화를 확인하지 못했습니다. 재전송하지 않고 멈췄습니다.");
   state["threadId"]=thread;state["route"]=driver.Route();if(!Data.Text(state,"route").EndsWith("/thread/"+thread.Replace("native:","")))throw new Exception("전송한 대화와 현재 화면이 다릅니다.");
   state["phase"]="submitted";Data.Save(statePath,state);
   if(api!=null)await api.Call(new{action="stage",id,stage="submitted",threadId=thread});Note("제작 요청 전달 완료. 완성 파일을 자동 감시합니다.");
  }
  async Task Deliver(){
   var id=Data.Text(job,"id");var thread=Data.Text(state,"threadId");if(String.IsNullOrEmpty(thread))throw new Exception("주문에 연결된 대화가 없습니다.");
   var remote=await api.Call(new{action="job",id});var latest=Data.Obj(remote["job"]);
   if(Data.Text(latest,"state")=="completed"){
    if(Data.Text(latest,"threadId")!=thread||Data.Text(latest,"resultSha256")!=Data.Text(state,"sha256"))throw new Exception("서버 완료 기록이 이 작업과 다릅니다.");Finish();return;
   }
   await api.Call(new{action="stage",id,stage="review",threadId=thread});Note("완성 영상 전체를 자동 검사합니다.");
   var bytes=await OutputVerifier.Verify(Data.JobDirectory(id),id,Data.Text(state,"nonce"),encoder);var sha=Data.Sha(bytes);
   if(Data.Text(state,"phase")=="uploading"&&Data.Text(state,"sha256")!=sha)throw new Exception("전달 중인 완성 파일이 변경되었습니다.");
   state["phase"]="uploading";state["sha256"]=sha;Data.Save(statePath,state);
   var signed=await api.Call(new{action="upload",id,size=bytes.Length,sha256=sha});await BridgeApi.Upload(Data.Text(signed,"url"),bytes);await api.Call(new{action="complete",id,threadId=thread,sha256=sha});Finish();
  }
  void Finish(){Data.Save(Path.Combine(Data.JobDirectory(Data.Text(job,"id")),"delivered.bin"),new{id=Data.Text(job,"id"),thread=Data.Text(state,"threadId"),sha=Data.Text(state,"sha256"),at=DateTime.UtcNow.ToString("o")});Data.Save(statePath,new{});job=null;state=null;order.Clear();Note("회원 보관함으로 자동 전달했습니다. 다음 주문을 기다립니다.");}

 }
 static class Program {
  [STAThread] static void Main(string[] args){if(args.Contains("--self-test")){try{SelfTest.Run();AutomaticChecks.Run().GetAwaiter().GetResult();}catch(Exception e){File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"test-failure.txt"),e.ToString());Environment.ExitCode=1;}return;}bool first;using(var mutex=new Mutex(true,"Local\\BESTSNSStudioBridge",out first)){if(!first){MessageBox.Show("제작 연결 프로그램이 이미 실행 중입니다.");return;}ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new BridgeForm());}}
 }
 static class SelfTest {
  public static void Run(){int checks=0;Action<bool> ok=b=>{if(!b)throw new Exception("Self test failed");checks++;};ok(Data.Site("https://www.bestsns.com/").Host=="www.bestsns.com");foreach(var url in new[]{"http://www.bestsns.com/","https://evil.com/","https://www.bestsns.com.evil.com/","https://www.bestsns.com/path","https://user@www.bestsns.com/"}){bool rejected=false;try{Data.Site(url);}catch{rejected=true;}ok(rejected);}bool invalid=false;try{Data.JobDirectory("../../escape");}catch{invalid=true;}ok(invalid);ok(Data.Sha(Encoding.UTF8.GetBytes("abc"))=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");var temp=Path.Combine(Path.GetTempPath(),"bestsns-test-"+Guid.NewGuid()+".bin");try{Data.Save(temp,new{message="한글 원문 그대로",phase="sending"});ok(Data.Text(Data.Read(temp),"message")=="한글 원문 그대로");ok(!Encoding.UTF8.GetString(File.ReadAllBytes(temp)).Contains("한글 원문 그대로"));Data.Save(temp,new{phase="attention"});ok(Data.Text(Data.Read(temp),"phase")=="attention");}finally{File.Delete(temp);}File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test.txt"),"PASS "+checks+" checks\n");}
 }
}
