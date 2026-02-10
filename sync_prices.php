<?php
require_once 'config.php';

// 프론트엔드로부터 공급처 목록을 받음
$input = json_decode(file_get_contents('php://input'), true);
$providers = $input['providers'] ?? [];

$results = [];

foreach ($providers as $p) {
    $id = $p['id'];
    $url = $p['apiUrl'];
    $key = $API_KEYS[$id] ?? '';

    if (!$key) continue;

    // SMM API의 표준 action=services 호출
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url . "?key=" . $key . "&action=services");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);

    if (is_array($data)) {
        foreach ($data as $service) {
            // 결과 구조: results['p1']['서비스ID'] = 원가
            // SMM API의 rate는 보통 1000개당 가격이므로 그대로 저장
            $results[$id][$service['service']] = (float)$service['rate'];
        }
    }
}

echo json_encode([
    'status' => 'success',
    'data' => $results
]);
?>