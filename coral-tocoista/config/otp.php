<?php

return [
    // 'whatsapp' (produção) ou 'log' (teste; o código só aparece no ecrã com APP_DEBUG=true)
    'driver' => env('OTP_DRIVER', 'log'),

    // Limite de pedidos de código por IP (por hora)
    'ip_requests_per_hour' => (int) env('OTP_IP_REQUESTS_PER_HOUR', 20),

    'whatsapp' => [
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'template' => env('WHATSAPP_TEMPLATE', 'codigo_acesso'),
        'language' => env('WHATSAPP_TEMPLATE_LANGUAGE', 'pt_PT'),
        'api_version' => env('WHATSAPP_API_VERSION', 'v21.0'),
    ],
];
