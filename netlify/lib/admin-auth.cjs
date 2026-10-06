const { admin, db, originAllowed } = require('./content-test.cjs');
async function authorized(event) {
  if (!originAllowed(event)) return false;
  try { return !!(await admin(event, db())); } catch { return false; }
}
module.exports = { authorized };
