<?php

namespace App\Services\Otp;

use App\Support\Phone;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * WhatsApp Business Cloud API — envio por template de categoria "Authentication".
 * O template deve ter um parâmetro no corpo ({{1}} = código) e o botão "copiar código"
 * (que também recebe o código como parâmetro). Ver README, secção WhatsApp.
 */
class WhatsAppOtpSender implements OtpSender
{
    public function __construct(private array $config) {}

    public function send(string $phone, string $code, int $validityMinutes): void
    {
        foreach (['token', 'phone_number_id', 'template'] as $key) {
            if (empty($this->config[$key])) {
                throw new OtpDeliveryException("WhatsApp não configurado: falta {$key}.");
            }
        }

        $url = sprintf('https://graph.facebook.com/%s/%s/messages',
            $this->config['api_version'] ?? 'v21.0', $this->config['phone_number_id']);

        $response = Http::withToken($this->config['token'])
            ->timeout(10)
            ->acceptJson()
            ->post($url, [
                'messaging_product' => 'whatsapp',
                'to' => Phone::international($phone),
                'type' => 'template',
                'template' => [
                    'name' => $this->config['template'],
                    'language' => ['code' => $this->config['language'] ?? 'pt_PT'],
                    'components' => [
                        ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $code]]],
                        ['type' => 'button', 'sub_type' => 'url', 'index' => '0',
                            'parameters' => [['type' => 'text', 'text' => $code]]],
                    ],
                ],
            ]);

        if ($response->failed()) {
            // Nunca registar o código no log em produção.
            Log::warning('[OTP:whatsapp] falha no envio', ['status' => $response->status(), 'body' => $response->json('error.message')]);
            throw new OtpDeliveryException('Não foi possível enviar o código por WhatsApp.');
        }
    }
}
