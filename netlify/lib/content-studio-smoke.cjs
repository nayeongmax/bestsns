// One explicitly authorized operator test. Never enables member production.
const orderId='83ac6120-b43c-4b44-9a44-5d9c4c04b817';
const workerId='f9c1ced9-ecbe-4e7f-92d0-0d23114e9b62';
const presetId='cloud_8b5ba438-a562-4757-b588-cbce625c2db1_1';
const message='BESTSNS 연결 테스트: 인형 눈을 가진 귀여운 문어가 바닷속 작은 카페에서 손님에게 인사하는 10초 세로 영상을 만들어 주세요. 한국어 자막은 오늘도 반가워요. 기존 프리셋의 영상 스타일을 적용하고 화면 흔들림 없이 완성해 주세요. 외부 게시 없이 MP4 결과물만 만들어 주세요.';
const active=()=>Date.now()<Date.parse('2026-11-14T03:50:00Z');
const permits=(admin,d)=>admin&&active()&&d.presetId===presetId&&d.text===message&&!d.parentId&&!(d.files||[]).length;
module.exports={orderId,workerId,presetId,message,active,permits};
