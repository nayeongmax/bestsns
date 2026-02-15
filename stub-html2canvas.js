// html2canvas 빌드 실패 방지용 stub (실제 사용하지 않음)
export default function html2canvas() {
  return Promise.resolve(document.createElement('canvas'));
}
