<?php

namespace App\Services\Otp;

use Illuminate\Support\Facades\Log;

/**
 * Driver de teste: escreve o código no log da aplicação.
 * O código só é mostrado no ecrã quando APP_DEBUG=true (ver OtpController).
 */
class LogOtpSender implements OtpSender
{
    public ?string $lastCode = null;

    public function send(string $phone, string $code, int $validityMinutes): void
    {
        $this->lastCode = $code;
        if (config('app.debug')) {
            session()->flash('otp_debug_code', $code);
            Log::info("[OTP:log] Código para +244{$phone}: {$code} (válido {$validityMinutes} min)");
        } else {
            Log::info("[OTP:log] Código gerado para +244{$phone} (oculto: APP_DEBUG=false)");
        }
    }
}
