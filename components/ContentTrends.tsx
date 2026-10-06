import React, { useState } from 'react';
const sources = [
  {name:'TikTok Creative Center',type:'인기 영상·음악·해시태그',description:'국가와 기간을 선택해 최근 흐름을 살펴보세요.',url:'https://ads.tiktok.com/business/creativecenter/pc/en'},
  {name:'YouTube Culture & Trends',type:'공식 트렌드 리포트',description:'YouTube가 공개하는 최신 영상 문화와 분석을 확인하세요.',url:'https://blog.youtube/culture-and-trends/'},
  {name:'YouTube Studio 트렌드',type:'내 채널의 검색 관심사',description:'내 채널로 로그인한 뒤 분석의 트렌드 탭에서 확인하세요.',url:'https://support.google.com/youtube/answer/11962757?hl=ko'},
];
const ideas = [
  {category:'맛집·카페',title:'첫 장면은 메뉴 클로즈업',description:'조리 과정 → 완성 메뉴 → 방문 안내. 음식 소리와 짧은 자막으로 구성.',prompt:'음식 클로즈업으로 시작하고 조리 과정과 완성 메뉴를 연결해 주세요. 짧은 자막과 마지막 매장 방문 안내를 넣어 주세요.'},
  {category:'뷰티·미용',title:'서비스 과정을 짧게',description:'준비 → 시술 과정 → 결과를 보여 주는 매장 소개.',prompt:'시술 준비, 과정, 결과를 순서대로 보여 주고 과장 없이 서비스 특징을 자막으로 소개해 주세요.'},
  {category:'쇼핑·브랜드',title:'한 제품, 세 가지 포인트',description:'디테일·사용 장면·추천 대상을 차례로 소개.',prompt:'제품의 디테일과 사용 장면을 보여 주면서 특징 세 가지를 자막으로 설명해 주세요.'},
];
export default function ContentTrends(){const [copied,setCopied]=useState('');return <section className="shorts-section content-trends" id="content-trends"><span className="shorts-eyebrow">FIND YOUR NEXT IDEA</span><h2>요즘 영상 흐름, 다음 콘텐츠로.</h2><p>공식 트렌드 자료를 열어 확인하고 우리 업종에 맞는 제작 아이디어를 찾아보세요.</p><div className="content-trend-sources">{sources.map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer"><span>{s.type}</span><h3>{s.name} ↗</h3><p>{s.description}</p><small>공식 사이트에서 확인</small></a>)}</div><h3>업종별 제작 아이디어</h3><p className="content-trend-note">아래는 제작 구성 예시입니다. 실시간 인기 순위나 최신 트렌드 측정값은 아닙니다.</p><div className="content-trend-ideas">{ideas.map(i=><article key={i.title}><span>{i.category}</span><h4>{i.title}</h4><p>{i.description}</p><button onClick={async()=>{try{await navigator.clipboard.writeText(i.prompt);setCopied(i.title);}catch{setCopied('복사하지 못했습니다. 아래 요청 문구를 직접 선택해 주세요.');}}}>제작 요청 복사</button><details><summary>요청 문구 보기</summary><p>{i.prompt}</p></details></article>)}</div><p role="status" className="content-trend-note">{copied&&(ideas.some(i=>i.title===copied)?'복사했습니다. 제작 대화창에 붙여 넣어 주세요.':copied)}</p></section>;}
