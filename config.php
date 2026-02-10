<?php
// 보안을 위해 이 파일에만 API KEY를 저장하세요.
// providerId는 어드민 패널에서 입력한 ID와 일치해야 합니다.
$API_KEYS = [
    'p1' => 'YOUR_JAP_API_KEY_HERE',
    'p2' => 'YOUR_SMM_MAIN_API_KEY_HERE',
    // '공급처ID' => '해당공급처API키' 형식으로 계속 추가 가능
];

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");
?>