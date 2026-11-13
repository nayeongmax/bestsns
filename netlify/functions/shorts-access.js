const { authorized } = require('../lib/admin-auth.cjs');
const { json } = require('../lib/content-test.cjs');
exports.handler = async event => {
 if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
 return json(200,{published:false,preview:await authorized(event),productionEnabled:false});
};
