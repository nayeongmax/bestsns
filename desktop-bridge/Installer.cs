using System;
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Windows.Forms;
static class Installer {
 [STAThread] static void Main(){
  Application.EnableVisualStyles();
  string folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","BESTSNSStudioBridge");
  if(MessageBox.Show("BESTSNS 제작 연결 프로그램을 다음 위치에 설치합니다.\n"+folder+"\n\n시작 메뉴 바로가기를 만듭니다. Windows 시작 시 자동 실행하지 않습니다.\n이 설치만으로 사이트 주문이나 유료 영상 제작이 시작되지는 않습니다.","BESTSNS 제작 연결 설치",MessageBoxButtons.OKCancel)!=DialogResult.OK)return;
  try{
   Directory.CreateDirectory(folder);string target=Path.Combine(folder,"BESTSNS-Studio-Bridge.exe");
   if(File.Exists(target)&&Process.GetProcessesByName("BESTSNS-Studio-Bridge").Length>0)throw new Exception("실행 중인 제작 연결 프로그램을 먼저 종료하세요.");
   using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("Bridge.exe"))using(var output=File.Create(target)){input.CopyTo(output);}
   Type shellType=Type.GetTypeFromProgID("WScript.Shell");dynamic shell=Activator.CreateInstance(shellType);
   string shortcut=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"BESTSNS 제작 연결.lnk");
   dynamic link=shell.CreateShortcut(shortcut);link.TargetPath=target;link.WorkingDirectory=folder;link.Description="BESTSNS 운영자 PC 제작 연결";link.Save();
   MessageBox.Show("설치를 완료했습니다. 시작 메뉴에서 'BESTSNS 제작 연결'을 실행하세요.\n사이트의 운영자 PC 연결키와 데이터베이스 설정이 필요합니다.","설치 완료");
  }catch(Exception e){MessageBox.Show("설치를 완료하지 못했습니다.\n"+e.Message,"설치 확인");}
 }
}
