import React, { useState } from 'react';

const Footer: React.FC = () => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="container mx-auto max-w-[1550px] px-4 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="space-y-4">
            <p className="text-sm font-black text-gray-800">THEBEST<span className="text-blue-600">SNS</span></p>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>상호</strong> 더베스트마케팅 </p>
              <p><strong>대표자</strong> 김나영 </p>
              <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5 </p>
              <p><strong>사업자번호</strong> 409-30-51469</p>
              <p><strong>통신판매업 신고번호</strong> 2022-대구달성-0164</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => { setShowTerms(!showTerms); setShowPrivacy(false); }} className="text-left text-sm font-bold text-blue-600 hover:underline">
              이용약관
            </button>
            <button type="button" onClick={() => { setShowPrivacy(!showPrivacy); setShowTerms(false); }} className="text-left text-sm font-bold text-blue-600 hover:underline">
              개인정보 처리방침
            </button>
          </div>
        </div>

        {showTerms && (
          <div className="mt-8 p-6 rounded-2xl bg-white border border-gray-200 text-sm max-h-[60vh] overflow-y-auto">
            <h4 className="font-black text-gray-900 mb-4">THEBESTSNS 서비스 이용약관 (통합본)</h4>
            <p className="text-gray-600 mb-4">이 약관은 플랫폼 이용 규칙과 각 서비스별 특이사항을 담고 있습니다.</p>
            <div className="space-y-4 text-gray-700">
              <div>
                <p className="font-black text-gray-900">제1조 (핵심 원칙: 직거래 절대 금지)</p>
                <p>THEBESTSNS 내의 모든 거래는 플랫폼 시스템을 통해 결제되어야 합니다. 플랫폼을 통하지 않고 직접 소통하거나 거래(직거래)하는 경우, 광고주와 프리랜서 모두에게 거래액의 10배를 위약벌로 청구하며 서비스 이용이 영구 제한됩니다.</p>
              </div>
              <div>
                <p className="font-black text-gray-900">제2조 (서비스별 이용 및 환불 규정)</p>
                <p>THEBESTSNS는 상품의 특성에 따라 개별 규칙을 적용합니다.</p>
                <ul className="mt-2 space-y-2">
                  <li><strong>SNS 활성화:</strong> 작업 개시 후 중도 취소 불가. 상품에 안내된 일수만큼 수량 복구(A/S) 보장</li>
                  <li><strong>채널 판매:</strong> 인도 후 10일간 본 작업 진행 금지. 해킹/회수 시 플랫폼이 A/S 진행 (양수인 과실 제외)</li>
                  <li><strong>N잡 스토어:</strong> 디지털 콘텐츠 거래. 파일 다운로드 완료 후 환불 불가 (복제 방지)</li>
                  <li><strong>누구나 알바:</strong> 플랫폼이 계약 주체가 되는 준 위탁형 구조. 작업 개시 전 전액 환불, 개시 후 범위에 따라 제한적 환불</li>
                </ul>
              </div>
              <div>
                <p className="font-black text-gray-900">제3조 (채널 거래 특별 규정)</p>
                <p>구글 계정 이전 시 보안을 위해 약 7일간의 소유주 변경 기간이 소요됨을 인지해야 합니다. 채널 인도 후 안내된 10일의 대기 기간을 어기고 작업을 진행하여 발생하는 계정 문제는 플랫폼이 책임지지 않습니다.</p>
              </div>
              <div>
                <p className="font-black text-gray-900">제4조 (저작권 및 무단 복제)</p>
                <p>N잡 스토어에서 구매한 자료를 무단 복제, 배포, 재판매하는 행위는 엄격히 금지되며 발견 시 법적 처벌과 함께 손해배상이 청구됩니다.</p>
              </div>
            </div>
          </div>
        )}

        {showPrivacy && (
          <div className="mt-8 p-6 rounded-2xl bg-white border border-gray-200 text-sm max-h-[60vh] overflow-y-auto">
            <h4 className="font-black text-gray-900 mb-4">THEBESTSNS 개인정보 처리방침</h4>
            <p className="text-gray-600 mb-4">이 방침은 사용자의 소중한 정보를 어떻게 보호하고 관리하는지를 설명합니다.</p>
            <div className="space-y-4 text-gray-700">
              <div>
                <p className="font-black text-gray-900">제1조 (수집 항목 및 목적)</p>
                <p>수집 항목: 이름(닉네임), 연락처, 이메일, 계좌정보(정산용), 사업자 정보(필요시). 목적: 서비스 제공, 대금 결제 및 정산, 고객 상담 및 분쟁 해결.</p>
              </div>
              <div>
                <p className="font-black text-gray-900">제2조 (보관 기간 안내: 5년)</p>
                <p>회사는 법적 의무에 따라 이용자의 거래 기록을 안전하게 보관합니다.</p>
                <ul className="mt-2 space-y-1">
                  <li><strong>5년 보관:</strong> 계약, 결제, 대금 지급 관련 기록 (세무 및 전자상거래법 준수)</li>
                  <li><strong>3년 보관:</strong> 고객 불만 및 분쟁 처리 기록</li>
                  <li><strong>3개월 보관:</strong> 사이트 방문 로그 (IP 주소 등)</li>
                </ul>
                <p className="mt-2 text-gray-600">SNS 활성화, 채널 판매, N잡 스토어, 누구나 알바 등 모든 거래 내역은 결제/계약 종료 시점으로부터 5년간 보관 후 파기합니다.</p>
              </div>
              <div>
                <p className="font-black text-gray-900">제3조 (정보 공유 제한)</p>
                <p>THEBESTSNS는 원칙적으로 프리랜서(파트너)의 실명, 주민번호, 계좌번호 등 민감 정보를 광고주에게 공개하지 않습니다. 모든 소통은 닉네임과 플랫폼 내부 채팅을 통해 이루어집니다.</p>
              </div>
              <div>
                <p className="font-black text-gray-900">제4조 (파기 절차)</p>
                <p>보관 기간이 경과하거나 수집 목적이 달성된 정보는 재생할 수 없는 기술적 방법을 통해 즉시 파기합니다.</p>
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="font-black text-blue-800 mb-2">💡 이용자를 위한 한 줄 요약 (FAQ)</p>
                <p><strong>Q: 환불은 언제 되나요?</strong><br />A: SNS 상품은 작업 시작 전, 알바(용역)는 작업 착수 단계에 따라 다릅니다. 디지털 파일(전자책)은 다운로드하면 환불이 안 되니 주의하세요!</p>
                <p className="mt-2"><strong>Q: 왜 10일 동안 채널 작업을 하면 안 되나요?</strong><br />A: 계정 소유권이 완전히 이전되는 보안 기간이 필요하기 때문입니다.</p>
                <p className="mt-2"><strong>Q: 제 개인정보는 안전한가요?</strong><br />A: 네, 광고주나 프리랜서끼리 서로의 실명이나 번호를 알 수 없게 플랫폼이 중간에서 보호하며, 거래 기록은 법에 따라 5년간만 보관됩니다.</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">© THEBESTSNS. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
