const { json, admin, db, originAllowed } = require('../lib/content-test.cjs');
const login = require('./content-admin-session.js');
exports.handler = async event => {
  if (!originAllowed(event)) return json(403,{error:'Origin not allowed'});
  if (event.httpMethod==='POST') return login.handler(event);
  if (event.httpMethod==='DELETE') return json(200,{authenticated:false},{'Set-Cookie':'content_admin=; HttpOnly; Secure; SameSite=Strict; Path=/.netlify/functions/; Max-Age=0'});
  if (event.httpMethod!=='GET') return json(405,{error:'Method not allowed'});
  try {
    const id=await admin(event,db());
    return json(id?200:401,{authenticated:!!id,...(id?{id,role:'admin'}:{})});
  } catch {return json(503,{error:'관리자 서버 인증 설정을 확인해 주세요.'});}
};
