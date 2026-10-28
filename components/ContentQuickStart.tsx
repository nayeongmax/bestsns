import React, { useState } from 'react';

const purposes = ['매장 알리기', '상품·메뉴 소개', '행사·할인 홍보', '일상·브이로그', '리뷰·사용 후기'];
const styles = [
  ['깔끔한 소개', '핵심 정보를 큰 자막으로 전달하고 장면 전환은 간결하게 구성'],
  ['빠른 하이라이트', '시작에 눈길을 끄는 장면을 배치하고 짧은 컷과 강조 자막으로 구성'],
  ['감성 기록', '자연스러운 장면 흐름과 차분한 자막으로 분위기를 전달'],
];
export default function ContentQuickStart({ disabled, onApply }: {
  disabled: boolean;
  onApply: (text: string, options: Record<string, string>) => void;
}) {
  const [purpose, setPurpose] = useState(purposes[0]);
  const [style, setStyle] = useState(styles[0][0]);
  const [length, setLength] = useState('30초');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  function apply() {
    const direction = styles.find(item => item[0] === style)![1];
    onApply([
      `목적: ${purpose}`, `소개할 대상: ${subject.trim()}`, `형식: 세로 9:16 쇼츠·릴스, ${length}`,
      `편집 방향: ${style} — ${direction}`,
      message.trim() ? `꼭 넣을 문구: ${message.trim()}` : '문구는 첨부한 소재를 바탕으로 제안해 주세요. 확인되지 않은 가격·효능·주소는 만들지 마세요.',
      '첨부한 원본 영상·사진으로 제작해 주세요. 참고 파일이 있다면 컷 길이·자막 배치·전환 방식을 분석해 반영해 주세요.',
      '음악 파일이 없으므로 임의로 외부 음악을 가져오지 말고 원본 소리를 활용하거나 무음으로 제작해 주세요.',
      '재생 가능한 MP4 완성본을 만들어 주세요.',
    ].join('\n'), { style: purpose, length });
  }
  return <fieldset className="ai-quick-start" disabled={disabled}>
    <legend>1. 어떤 영상을 만들까요?</legend>
    <p>목적과 분위기만 고르면 제작 요청을 채워드려요.</p>
    <label>영상의 목적<select value={purpose} onChange={e => setPurpose(e.target.value)}>{purposes.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>가게·상품·채널 이름<input value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="예: 나영카페의 딸기라떼 / 나영의 주말 브이로그" /></label>
    <span>원하는 분위기</span><div className="ai-quick-styles">{styles.map(([name, description]) => <button type="button" key={name} aria-pressed={style === name} onClick={() => setStyle(name)}><strong>{name}</strong><small>{description}</small></button>)}</div>
    <label>영상 길이<select value={length} onChange={e => setLength(e.target.value)}>{['15초', '30초', '60초'].map(item => <option key={item}>{item}</option>)}</select></label>
    <label>꼭 넣을 문구 · 선택<textarea value={message} maxLength={1000} rows={2} onChange={e => setMessage(e.target.value)} placeholder="예: 이번 주 신메뉴 출시! / 마지막에 채널 이름을 넣어주세요." /></label>
    <button type="button" className="ai-solid" disabled={!subject.trim()} onClick={apply}>이 내용으로 요청 채우기</button>
    <p>2. 아래에 원본을 첨부하고, 3. 제작 요청을 확인한 뒤 보내세요. 이 버튼만으로 제작하거나 비용을 사용하지 않습니다.</p>
    <details><summary>지금 가능한 기능과 준비 중인 기능</summary><ul>
      <li>현재 테스트 범위: 내 영상·사진으로 쇼츠 편집, 자막·화면 전환 요청, 결과 확인과 대화로 수정.</li>
      <li>위 분위기는 편집 지침입니다. 분석된 프리셋 영상 라이브러리는 준비 중입니다.</li>
      <li>참고 영상은 파일로 첨부하세요. 유튜브·인스타그램 링크 자동 분석, BGM 파일 첨부·링크 가져오기는 준비 중입니다.</li>
      <li>롱폼, 새로운 장면 생성, SNS 자동 게시는 아직 지원하지 않습니다.</li>
      <li>실제 영상 제작은 관리자 테스트 단계입니다. 완성 품질·처리 시간은 아직 검증되지 않았습니다.</li>
    </ul></details>
  </fieldset>;
}
