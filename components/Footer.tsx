import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-gray-50/95 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
          <p className="text-base sm:text-lg font-black text-gray-800 tracking-tight order-2 sm:order-1">THEBEST<span className="text-blue-600">SNS</span></p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-center order-1 sm:order-2">
            <div className="text-[11px] sm:text-xs text-gray-600 space-x-3 sm:space-x-4 inline-flex flex-wrap justify-center">
              <span><strong className="text-gray-500">상호</strong> THEBESTSNS</span>
              <span><strong className="text-gray-500">대표</strong> 김나영</span>
              <span className="hidden xs:inline"><strong className="text-gray-500">사업자번호</strong> 409-30-51469</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] sm:text-xs">
              <Link to="/terms" className="font-bold text-blue-600 hover:underline">이용약관</Link>
              <Link to="/privacy" className="font-bold text-blue-600 hover:underline">개인정보처리방침</Link>
            </div>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-1">© THEBESTSNS. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
