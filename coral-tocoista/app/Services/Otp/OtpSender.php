<?php

namespace App\Services\Otp;

interface OtpSender
{
    /**
     * Envia o código ao telefone (9 dígitos angolanos).
     *
     * @throws OtpDeliveryException quando o envio falha
     */
    public function send(string $phone, string $code, int $validityMinutes): void;
}
