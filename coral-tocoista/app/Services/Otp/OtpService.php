<?php

namespace App\Services\Otp;

use App\Models\OtpCode;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Regras do código OTP:
 *  - 6 dígitos aleatórios, guardados apenas como hash;
 *  - validade configurável (Setting otp_validity_minutes, por defeito 5 min);
 *  - máximo 3 tentativas por código; à 3.ª errada o código fica inutilizado;
 *  - máximo 1 pedido por minuto por número (o limite por IP é feito no controller).
 */
class OtpService
{
    public const RESEND_SECONDS = 60;

    public function __construct(private OtpSender $sender) {}

    /** Segundos que faltam até o número poder pedir novo código (0 = pode pedir). */
    public function secondsUntilResend(string $phone): int
    {
        $last = OtpCode::where('phone', $phone)->latest('id')->first();
        if (! $last) {
            return 0;
        }
        $elapsed = (int) $last->created_at->diffInSeconds(now(), true);

        return max(0, self::RESEND_SECONDS - $elapsed);
    }

    public function issue(string $phone, ?string $ip = null): OtpCode
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $minutes = Setting::otpValidityMinutes();

        $otp = DB::transaction(function () use ($phone, $code, $minutes, $ip) {
            // Um novo pedido invalida os códigos anteriores do mesmo número.
            OtpCode::where('phone', $phone)->whereNull('consumed_at')->whereNull('invalidated_at')
                ->update(['invalidated_at' => now()]);

            return OtpCode::create([
                'phone' => $phone,
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes($minutes),
                'ip' => $ip,
            ]);
        });

        $this->sender->send($phone, $code, $minutes);

        return $otp;
    }

    /**
     * @return string 'ok' | 'invalid' | 'expired' | 'locked' | 'missing'
     */
    public function verify(string $phone, string $code): string
    {
        return DB::transaction(function () use ($phone, $code) {
            $otp = OtpCode::where('phone', $phone)->whereNull('consumed_at')->whereNull('invalidated_at')
                ->latest('id')->lockForUpdate()->first();

            if (! $otp) {
                return 'missing';
            }
            if ($otp->expires_at->isPast()) {
                return 'expired';
            }
            if ($otp->attempts >= OtpCode::MAX_ATTEMPTS) {
                return 'locked';
            }

            if (! Hash::check($code, $otp->code_hash)) {
                $otp->attempts++;
                if ($otp->attempts >= OtpCode::MAX_ATTEMPTS) {
                    $otp->invalidated_at = now();
                }
                $otp->save();

                return $otp->attempts >= OtpCode::MAX_ATTEMPTS ? 'locked' : 'invalid';
            }

            $otp->consumed_at = now();
            $otp->save();

            return 'ok';
        });
    }

    public function remainingAttempts(string $phone): int
    {
        $otp = OtpCode::where('phone', $phone)->latest('id')->first();

        return $otp ? max(0, OtpCode::MAX_ATTEMPTS - $otp->attempts) : 0;
    }
}
