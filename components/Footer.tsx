import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="container mx-auto max-w-[1550px] px-4 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="space-y-1">
            <p className="text-sm font-black text-gray-800">THEBEST<span className="text-blue-600">SNS</span></p>
            <div className="text-xs text-gray-600 space-y-0.5">
              <p><strong>상호</strong> THEBESTSNS</p>
              <p><strong>대표자</strong> 김나영</p>
              <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p>
              <p><strong>사업자번호</strong> 409-30-51469</p>
              <p><strong>통신판매업 신고번호</strong> 2022-대구달성-0164</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/terms" className="text-left text-sm font-bold text-blue-600 hover:underline">
              이용약관
            </Link>
            <Link to="/privacy" className="text-left text-sm font-bold text-blue-600 hover:underline">
              개인정보 처리방침
            </Link>
          </div>
          <div className="text-xs text-gray-400 md:text-right">
            © THEBESTSNS. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
