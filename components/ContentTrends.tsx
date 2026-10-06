import React from 'react';
import ContentServiceRequest from './ContentServiceRequest';
const sources = [
  {name:'TikTok Creative Center',type:'인기 영상·음악·해시태그',description:'국가와 기간을 선택해 최근 흐름을 살펴보세요.',url:'https://ads.tiktok.com/business/creativecenter/pc/en'},
  {name:'YouTube Culture & Trends',type:'공식 트렌드 리포트',description:'YouTube가 공개하는 최신 영상 문화와 분석을 확인하세요.',url:'https://blog.youtube/culture-and-trends/'},
  {name:'YouTube Studio 트렌드',type:'내 채널의 검색 관심사',description:'내 채널로 로그인한 뒤 분석의 트렌드 탭에서 확인하세요.',url:'https://support.google.com/youtube/answer/11962757?hl=ko'},
];
export default function ContentTrends(){return <section className="shorts-section content-trends" id="content-trends"><span className="shorts-eyebrow">FIND YOUR NEXT IDEA</span><h2>요즘 영상 흐름, 다음 콘텐츠로.</h2><p>공식 트렌드 자료에서 최신 흐름을 확인해 보세요.</p><div className="content-trend-sources">{sources.map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer"><span>{s.type}</span><h3>{s.name} ↗</h3><p>{s.description}</p><small>공식 사이트에서 확인</small></a>)}</div><ContentServiceRequest /></section>;}