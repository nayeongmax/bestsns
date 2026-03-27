import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <>
      {/* 데스크톱(xl 이상): 원래 긴 푸터, 문서 흐름 유지 */}
      <footer className="hidden xl:block mt-auto border-t border-gray-200 bg-gray-50">
        <div className="w-full max-w-4xl mx-auto px-8 md:px-12 py-8">
          <div className="flex justify-center mb-8">
            <p className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">BEST<span className="text-blue-600">SNS</span></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-8 items-start justify-items-center md:justify-items-stretch text-center md:text-left">
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500 uppercase">사업자 정보</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>상호</strong> 더베스트[THEBEST]</p>
                <p><strong>대표자</strong> 김나영</p>
                <p><strong>연락처</strong> 070-4571-9555</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500 uppercase">등록 정보</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>사업자번호</strong> 409-30-51469</p>
                <p className="whitespace-nowrap"><strong>통신판매업신고번호</strong> 2022-대구달성-0164</p>
                <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p>
              </div>
            </div>
            <div className="space-y-2 flex flex-col items-center md:items-start">
              <p className="text-xs font-black text-gray-500 uppercase">약관 및 정책</p>
              <div className="flex flex-col gap-2">
                <Link to="/terms" className="text-sm font-bold text-blue-600 hover:underline">이용약관</Link>
                <Link to="/privacy" className="text-sm font-bold text-blue-600 hover:underline">개인정보 처리방침</Link>
                <Link to="/marketing-consent" className="text-sm font-bold text-blue-600 hover:underline">마케팅 정보 수신 동의</Link>
              </div>
            </div>
          </div>

          {/* 책임 문구 박스 */}
          <div className="mt-6 border border-gray-300 rounded-lg px-6 py-4 bg-white">
            <p className="text-sm text-gray-700 font-bold">해당 사이트 내 거래에 대한 책임, 환불 민원 등의 처리는 더베스트에서 진행합니다.</p>
          </div>

          <p className="text-xs text-gray-400 text-center mt-6">© 더베스트[THEBEST]. All rights reserved.</p>
        </div>
      </footer>

      {/* 모바일·태블릿(xl 미만): 문서 흐름, 모든 정보 표시 */}
      <footer className="xl:hidden mt-auto border-t border-gray-200 bg-gray-50">
        <div className="w-full max-w-2xl mx-auto px-4 py-6">
          <div className="flex justify-center mb-4">
            <p className="text-xl font-black text-gray-800 tracking-tight">BEST<span className="text-blue-600">SNS</span></p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 mb-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-500 uppercase">사업자 정보</p>
              <div className="text-[11px] text-gray-700 space-y-0.5">
                <p><strong>상호</strong> 더베스트[THEBEST]</p>
                <p><strong>대표자</strong> 김나영</p>
                <p><strong>연락처</strong> 070-4571-9555</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black text-gray-500 uppercase">등록 정보</p>
              <div className="text-[11px] text-gray-700 space-y-0.5">
                <p><strong>사업자번호</strong> 409-30-51469</p>
                <p><strong>통신판매업신고번호</strong> 2022-대구달성-0164</p>
                <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 mb-4">
            <p className="text-[10px] font-black text-gray-500 uppercase">약관 및 정책</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/terms" className="text-[11px] font-bold text-blue-600 hover:underline">이용약관</Link>
              <Link to="/privacy" className="text-[11px] font-bold text-blue-600 hover:underline">개인정보 처리방침</Link>
              <Link to="/marketing-consent" className="text-[11px] font-bold text-blue-600 hover:underline">마케팅 정보 수신 동의</Link>
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg px-4 py-3 bg-white mb-3">
            <p className="text-[11px] text-gray-700 font-bold">해당 사이트 내 거래에 대한 책임, 환불 민원 등의 처리는 더베스트에서 진행합니다.</p>
          </div>
          <p className="text-[10px] text-gray-400 text-center">© 더베스트[THEBEST]. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default Footer;
