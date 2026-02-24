import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="w-full max-w-4xl mx-auto px-8 md:px-12 py-8">
        <div className="flex justify-center mb-8">
          <p className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">THEBEST<span className="text-blue-600">SNS</span></p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-16 gap-y-8 items-start justify-items-center md:justify-items-stretch text-center md:text-left">
          <div className="space-y-2">
            <p className="text-xs font-black text-gray-500 uppercase">사업자 정보</p>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>상호</strong> THEBESTSNS</p>
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
        <p className="text-xs text-gray-400 text-center mt-6">© THEBESTSNS. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
