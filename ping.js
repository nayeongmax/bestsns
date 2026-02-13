// 테스트용 함수 - Netlify Functions 배포 확인용
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true, message: 'Functions 동작 중' }),
});
