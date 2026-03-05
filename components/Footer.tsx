import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <>
      {/* 데스크톱(xl 이상): 원래 긴 푸터, 문서 흐름 유지 */}
      <footer className="hidden xl:block mt-auto border-t border-gray-200 bg-gray-50">
        <div className="w-full max-w-4xl mx-auto px-8 md:px-12 py-8">
          <div className="flex justify-center mb-8">
            <p className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">THEBEST<span className="text-blue-600">SNS</span></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-8 items-start justify-items-center md:justify-items-stretch text-center md:text-left">
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500 uppercase">사업자 정보</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>상호</strong> 더베스트[THEBEST]</p>
                <p><strong>대표자</strong> 김나영</p>
                <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500 uppercase">등록 정보</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p><strong>사업자번호</strong> 409-30-51469</p>
                <p className="whitespace-nowrap"><strong>통신판매업신고번호</strong> 2022-대구달성-0164</p>
              </div>
            </div>
            <div className="space-y-2 flex flex-col items-center md:items-start">
              <p className="text-xs font-black text-gray-500 uppercase">약관 및 정책</p>
              <div className="flex flex-col gap-2">
                <Link to="/terms" className="text-sm font-bold text-blue-600 hover:underline">
                  이용약관
                </Link>
                <Link to="/privacy" className="text-sm font-bold text-blue-600 hover:underline">
                  개인정보 처리방침
                </Link>
              </div>
            </div>
          </div>

          {/* 책임 문구 박스 */}
          <div className="mt-6 border border-gray-300 rounded-lg px-6 py-4 bg-white">
            <p className="text-sm font-black text-gray-800 mb-1">더베스트[THEBEST]</p>
            <p className="text-sm text-gray-700 font-bold">해당 사이트 내 거래에 대한 책임, 환불 민원 등의 처리는 더베스트에서 진행합니다.</p>
            <p className="text-xs text-gray-500 mt-2">
              대표자: 김나영&nbsp;&nbsp;|&nbsp;&nbsp;사업자등록번호: 409-30-51469&nbsp;&nbsp;|&nbsp;&nbsp;주소: 대구광역시 달성군 현풍로6길 5&nbsp;&nbsp;|&nbsp;&nbsp;통신판매업신고번호: 2022-대구달성-0164
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center mt-6">© 더베스트[THEBEST]. All rights reserved.</p>
        </div>
      </footer>

      {/* 모바일·태블릿(xl 미만): 하단 고정, 작게 표시 */}
      <footer className="xl:hidden fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-gray-50/95 backdrop-blur-sm">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
            <p className="text-base sm:text-lg font-black text-gray-800 tracking-tight order-2 sm:order-1">THEBEST<span className="text-blue-600">SNS</span></p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center order-1 sm:order-2">
              <div className="text-[11px] sm:text-xs text-gray-600 space-x-3 sm:space-x-4 inline-flex flex-wrap justify-center">
                <span><strong className="text-gray-500">상호</strong> 더베스트[THEBEST]</span>
                <span><strong className="text-gray-500">대표</strong> 김나영</span>
                <span className="hidden sm:inline"><strong className="text-gray-500">사업자번호</strong> 409-30-51469</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] sm:text-xs">
                <Link to="/terms" className="font-bold text-blue-600 hover:underline">이용약관</Link>
                <Link to="/privacy" className="font-bold text-blue-600 hover:underline">개인정보처리방침</Link>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 font-bold text-center mt-1">해당 사이트 내 거래에 대한 책임, 환불 민원 등의 처리는 더베스트에서 진행합니다.</p>
          <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-0.5">© 더베스트[THEBEST]. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default Footer;
