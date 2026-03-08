import React from 'react';
import { useNavigate } from 'react-router-dom';

const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-700">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">이용약관</h2>
          <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.2em]">THEBESTSNS 서비스 이용약관 (통합본)</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm font-black text-gray-400 hover:text-gray-900 italic uppercase transition-colors">닫기</button>
      </div>

      <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-sm border border-gray-100 space-y-8 text-gray-700">
        <div className="space-y-8">

          <div>
            <p className="font-black text-gray-900 text-lg">제1조 목적</p>
            <p className="mt-2">이 약관은 더베스트 THEBEST가 운영하는 THEBESTSNS 플랫폼에서 제공하는 각종 마케팅 서비스, 채널 거래, 디지털 콘텐츠 판매, 작업 매칭 서비스 등의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 한다.</p>
            <p className="mt-2">본 약관은 플랫폼 이용에 관한 기본 원칙과 서비스별 운영 정책을 포함하며, 회원은 서비스를 이용함으로써 본 약관에 동의한 것으로 간주된다.</p>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제2조 정의</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. THEBESTSNS란 더베스트 THEBEST가 운영하는 온라인 플랫폼으로서 회원이 온라인 마케팅 서비스, SNS 활성화 서비스, 채널 거래, 디지털 콘텐츠 판매 및 작업 매칭 서비스를 이용할 수 있도록 제공되는 전자적 시스템을 의미한다.</li>
              <li>2. 회원이란 THEBESTSNS에 가입하여 회사가 제공하는 서비스를 이용하는 자를 의미하며 광고주, 구매자, 판매자, 프리랜서, 의뢰인 등 서비스 성격에 따라 다양한 역할을 수행할 수 있다.</li>
              <li>3. 직거래란 플랫폼의 결제 시스템을 통하지 않고 회원 상호 간에 직접 거래하거나 거래를 시도하는 모든 행위를 의미한다.</li>
              <li>4. 포인트 또는 충전 포인트란 회원이 플랫폼에서 서비스 이용을 위해 충전하거나 지급받은 예치성 금액을 의미하며 1포인트는 1원과 동일한 가치를 가진다.</li>
              <li>5. 서비스란 플랫폼을 통해 제공되는 SNS 활성화 서비스, 채널 거래 서비스, 디지털 콘텐츠 판매 서비스, 작업 매칭 서비스 등 회사가 제공하는 모든 기능을 의미한다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제3조 약관의 명시 및 개정</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 회사는 본 약관의 내용을 회원이 확인할 수 있도록 플랫폼 내에 게시한다.</li>
              <li>2. 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며 약관을 개정하는 경우 적용일자 및 개정 사유를 명시하여 사전에 공지한다.</li>
              <li>3. 개정된 약관은 공지된 적용일 이후 체결되는 계약부터 적용된다.</li>
              <li>4. 회원이 개정 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제4조 회원가입</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 회원가입은 이용자가 플랫폼에서 제공하는 가입 양식에 필요한 정보를 입력하고 약관에 동의함으로써 이루어진다.</li>
              <li>2. 회사는 다음 각 호에 해당하는 경우 회원가입을 제한하거나 거절할 수 있다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>가. 타인의 정보를 도용하여 가입한 경우</li>
                  <li>나. 허위 정보를 기재한 경우</li>
                  <li>다. 서비스 운영에 중대한 지장을 줄 우려가 있는 경우</li>
                  <li>라. 법령 또는 약관을 위반한 이력이 있는 경우</li>
                </ul>
              </li>
              <li>3. 회원가입 계약의 성립 시기는 회사가 가입 신청을 승인한 시점으로 한다.</li>
              <li>4. 회원은 가입 시 입력한 정보에 변경이 발생한 경우 즉시 정보를 수정하여야 한다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제5조 직거래 금지 원칙</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. THEBESTSNS 내 모든 거래는 플랫폼 결제 시스템을 통해 진행되어야 한다.</li>
              <li>2. 플랫폼을 통하지 않고 회원 간 직접 거래를 시도하거나 진행하는 경우 다음과 같은 제재가 적용된다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>가. 거래 금액의 10배에 해당하는 위약벌 부과</li>
                  <li>나. 계정 영구 이용 제한</li>
                  <li>다. 필요 시 민형사상 법적 조치</li>
                </ul>
              </li>
              <li>3. 직거래 시도에는 다음 행위가 포함된다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>가. 외부 연락처 전달</li>
                  <li>나. 플랫폼 외 결제 유도</li>
                  <li>다. 외부 메신저 또는 계좌를 통한 거래 진행</li>
                </ul>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제6조 서비스 이용 및 운영</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 회사는 특별한 사유가 없는 한 연중무휴 24시간 서비스를 제공하기 위해 노력한다.</li>
              <li>2. 시스템 점검, 기술적 장애, 외부 서비스 문제 등 불가피한 사유가 발생하는 경우 서비스 제공이 제한될 수 있다.</li>
              <li>3. 회사는 서비스의 안정적인 운영을 위하여 서비스 내용, 가격, 제공 방식을 변경할 수 있다.</li>
              <li>4. 회사는 회원에게 사전 고지 없이 서비스의 일부 기능을 제한하거나 중단할 수 있다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제7조 서비스별 이용 규정</p>
            <p className="mt-2">THEBESTSNS는 서비스 특성에 따라 다음과 같은 개별 규정을 적용한다.</p>
            <ul className="mt-3 space-y-3 pl-2">
              <li><strong>SNS 활성화 서비스</strong>
                <p className="mt-1 text-sm text-gray-600">작업이 시작된 이후에는 중도 취소가 불가능하다. 상품에 명시된 기간 동안 수량 이탈에 대한 복구 서비스가 제공될 수 있다.</p>
              </li>
              <li><strong>채널 거래 서비스</strong>
                <p className="mt-1 text-sm text-gray-600">채널 인도 이후 최소 10일 동안 채널 운영 및 작업을 진행하지 않아야 한다. 채널 인수 이후 해킹 또는 계정 회수 문제가 발생하는 경우 플랫폼은 A/S 지원을 진행할 수 있으나 회원의 과실로 발생한 경우에는 제외된다.</p>
              </li>
              <li><strong>N잡 스토어</strong>
                <p className="mt-1 text-sm text-gray-600">디지털 콘텐츠 상품의 특성상 파일 다운로드가 완료된 이후에는 환불이 불가능하다.</p>
              </li>
              <li><strong>누구나 알바</strong>
                <p className="mt-1 text-sm text-gray-600">작업 시작 전에는 전액 취소 및 환불이 가능하다. 프리랜서 선정 및 작업 내용 전달이 완료된 이후에는 환불이 제한될 수 있다.</p>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제8조 채널 거래 특별 규정</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 유튜브 채널 등 계정 이전 시 보안을 위해 약 7일간의 소유권 이전 기간이 소요될 수 있다.</li>
              <li>2. 채널 인도 이후 안내된 대기 기간을 준수하지 않아 발생하는 문제에 대해서 회사는 책임을 지지 않는다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제9조 저작권 및 무단 복제 금지</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 플랫폼을 통해 제공되는 디지털 콘텐츠 및 자료에 대한 저작권은 판매자 또는 회사에게 귀속된다.</li>
              <li>2. 회원은 구매한 자료를 무단으로 복제하거나 재판매 또는 배포할 수 없다.</li>
              <li>3. 이를 위반할 경우 법적 책임 및 손해배상 책임이 발생할 수 있다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제10조 포인트 사용 및 환불 규정</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 충전 포인트는 플랫폼 내에서만 사용할 수 있으며 외부 서비스에서는 사용할 수 없다.</li>
              <li>2. 포인트를 전혀 사용하지 않은 경우에 한하여 환불이 가능하다.</li>
              <li>3. 포인트 구매 후 14일이 경과한 경우 환불이 불가능하다.</li>
              <li>4. 환불은 결제 시 사용한 동일한 결제 수단으로만 처리된다.</li>
              <li>5. 포인트의 유효기간은 충전일로부터 1년이며 기간이 경과하면 자동 소멸된다.</li>
              <li>6. 다음에 해당하는 포인트는 환불이 불가능하다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>· 이벤트 지급 포인트</li>
                  <li>· 무상 지급 포인트</li>
                  <li>· 회원이 직접 결제하지 않은 포인트</li>
                </ul>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제11조 회원의 의무</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 회원은 서비스 이용 시 관련 법령과 본 약관을 준수해야 한다.</li>
              <li>2. 회원은 타인의 계정을 도용하거나 플랫폼의 정상적인 운영을 방해하는 행위를 해서는 안 된다.</li>
              <li>3. 회원은 회사의 명예를 훼손하거나 업무를 방해하는 행위를 해서는 안 된다.</li>
              <li>4. 회원은 서비스 이용 과정에서 발생하는 모든 책임을 본인이 부담한다.</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제12조 회원 탈퇴 및 이용 제한</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>1. 회원은 언제든지 탈퇴를 요청할 수 있다.</li>
              <li>2. 다음 각 호에 해당하는 경우 회사는 회원의 이용을 제한하거나 계정을 삭제할 수 있다.
                <ul className="mt-1 pl-4 space-y-1 text-sm text-gray-600">
                  <li>가. 약관을 위반한 경우</li>
                  <li>나. 불법 행위를 한 경우</li>
                  <li>다. 직거래를 시도하거나 진행한 경우</li>
                  <li>라. 플랫폼 운영을 방해한 경우</li>
                </ul>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제13조 손해배상</p>
            <p className="mt-2">회원의 귀책 사유로 회사 또는 제3자에게 손해가 발생한 경우 회원은 해당 손해를 배상할 책임이 있다.</p>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제14조 면책조항</p>
            <p className="mt-2">회사는 다음 각 호의 사유로 발생한 손해에 대해 책임을 지지 않는다.</p>
            <ul className="mt-2 pl-4 space-y-1 text-sm text-gray-600">
              <li>· 천재지변 등 불가항력</li>
              <li>· 회원의 귀책 사유</li>
              <li>· 통신 장애 또는 시스템 오류</li>
              <li>· 외부 서비스 문제</li>
            </ul>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제15조 준거법 및 관할</p>
            <p className="mt-2">본 약관은 대한민국 법령에 따라 해석되며 서비스 이용과 관련하여 발생하는 분쟁은 회사 본사 소재지를 관할하는 법원을 전속 관할 법원으로 한다.</p>
          </div>

          <div>
            <p className="font-black text-gray-900 text-lg">제16조 약관 외 준칙</p>
            <p className="mt-2">본 약관에 명시되지 않은 사항은 관련 법령 및 일반 상관례에 따른다.</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TermsPage;
