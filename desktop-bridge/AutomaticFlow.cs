using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
namespace BestSnsBridge {
 public static class AutomaticFlow {
  // A restored ambiguous UI action is never sent again. Delivery is idempotent.
  public static async Task Tick(Dictionary<string,object> state,Func<Task> start,Func<Task<bool>> ready,Func<Task> deliver){
   switch(Data.Text(state,"phase")){
    case "claimed": await start();break;
    case "submitted": if(await ready())await deliver();break;
    case "uploading": await deliver();break;
    default: throw new Exception("이 주문은 자동 재실행할 수 없는 상태입니다. 제작 요청을 다시 전송하지 않았습니다.");
   }
  }
 }
}
