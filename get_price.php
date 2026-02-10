<?php
require_once 'config.php';

// 에러 보고 활성화 (디버깅용, 실제 서비스 시에는 끄는 것이 좋으나 현재는 에러 추적을 위해 유지)
error_reporting(E_ALL);
ini_set('display_errors', 0);

$providerId = $_GET['providerId'] ?? '';
$serviceId = $_GET['serviceId'] ?? '';
$apiUrl = $_GET['apiUrl'] ?? '';

$key = $API_KEYS[$providerId] ?? '';

if (!$key || !$apiUrl || !$serviceId) {
    echo json_encode(['status' => 'error', 'message' => '공급처 설정이나 서비스 ID가 올바르지 않습니다. config.php를 확인하세요.']);
    exit;
}

$ch = curl_init();
$fullUrl = $apiUrl . "?key=" . $key . "&action=services";
curl_setopt($ch, CURLOPT_URL, $fullUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // SSL 인증서 문제로 인한 실패 방지

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    echo json_encode(['status' => 'error', 'message' => '공급처 API 연결 실패: ' . $curlError]);
    exit;
}

if ($httpCode !== 200) {
    echo json_encode(['status' => 'error', 'message' => '공급처 서버 응답 코드: ' . $httpCode]);
    exit;
}

$services = json_decode($response, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['status' => 'error', 'message' => 'API 응답 데이터 형식이 올바르지 않습니다. (JSON 파싱 실패)']);
    exit;
}

$foundPrice = null;

if (is_array($services)) {
    foreach ($services as $s) {
        // 서비스 ID가 숫자 형태일 수 있으므로 유연하게 비교
        if (isset($s['service']) && (string)$s['service'] === (string)$serviceId) {
            $foundPrice = (float)$s['rate'];
            break;
        }
    }
}

if ($foundPrice !== null) {
    echo json_encode(['status' => 'success', 'price' => $foundPrice]);
} else {
    echo json_encode(['status' => 'error', 'message' => '해당 서비스 ID(' . $serviceId . ')를 공급처 리스트에서 찾을 수 없습니다.']);
}
?>