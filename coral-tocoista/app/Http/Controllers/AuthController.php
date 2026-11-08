<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Otp\OtpDeliveryException;
use App\Services\Otp\OtpService;
use App\Support\Audit;
use App\Support\Phone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function __construct(private OtpService $otp) {}

    public function showPhone(): View
    {
        return view('auth.phone');
    }

    public function sendCode(Request $request): RedirectResponse
    {
        $request->validate(['phone' => ['required', 'string', 'max:20']], [], ['phone' => 'telefone']);
        $phone = Phone::normalize($request->input('phone'));
        if (! $phone) {
            throw ValidationException::withMessages(['phone' => 'Introduza um número angolano válido: 9 dígitos a começar por 9 (ex.: 923 456 789).']);
        }

        // Utilizador bloqueado não recebe código.
        if (User::where('phone', $phone)->whereNotNull('blocked_at')->exists()) {
            Audit::log('otp_request', null, null, ['phone' => $phone], 'Pedido recusado: número bloqueado');
            throw ValidationException::withMessages(['phone' => 'Este número está bloqueado. Contacte a administração.']);
        }

        // Máximo 1 pedido por minuto por número.
        if ($wait = $this->otp->secondsUntilResend($phone)) {
            $request->session()->put('otp_phone', $phone);
            throw ValidationException::withMessages(['phone' => "Já foi enviado um código. Aguarde {$wait} segundos para pedir outro."]);
        }

        try {
            $this->otp->issue($phone, $request->ip());
        } catch (OtpDeliveryException $e) {
            report($e);
            throw ValidationException::withMessages(['phone' => 'Não foi possível enviar o código agora. Tente novamente dentro de alguns minutos.']);
        }

        Audit::log('otp_request', null, null, ['phone' => $phone], 'Código enviado');
        $request->session()->put('otp_phone', $phone);

        return redirect()->route('login.code')->with('status', 'Enviámos um código de 6 dígitos para o seu WhatsApp.');
    }

    public function showCode(Request $request): View|RedirectResponse
    {
        $phone = $request->session()->get('otp_phone');
        if (! $phone) {
            return redirect()->route('login');
        }

        return view('auth.code', [
            'phone' => Phone::format($phone),
            'wait' => $this->otp->secondsUntilResend($phone),
            'debugCode' => config('app.debug') ? session('otp_debug_code') : null,
        ]);
    }

    public function verifyCode(Request $request): RedirectResponse
    {
        $phone = $request->session()->get('otp_phone');
        if (! $phone) {
            return redirect()->route('login');
        }
        $request->validate(['code' => ['required', 'digits:6']], [
            'code.required' => 'Introduza o código recebido.',
            'code.digits' => 'O código tem 6 dígitos.',
        ]);

        $result = $this->otp->verify($phone, $request->input('code'));

        if ($result !== 'ok') {
            if ($result === 'invalid' || $result === 'locked') {
                Audit::log('otp_failed', null, null, ['phone' => $phone], $result === 'locked' ? 'Código bloqueado (3 tentativas)' : 'Código errado');
            }
            $message = match ($result) {
                'invalid' => 'Código incorrecto. Restam '.$this->otp->remainingAttempts($phone).' tentativa(s).',
                'locked' => 'Código errado 3 vezes. Por segurança o código foi anulado: peça um novo código.',
                'expired' => 'O código expirou. Peça um novo código.',
                default => 'Não existe nenhum código válido. Peça um novo código.',
            };
            throw ValidationException::withMessages(['code' => $message]);
        }

        $request->session()->forget('otp_phone');
        $request->session()->regenerate();
        $user = User::where('phone', $phone)->first();

        if (! $user) {
            // Número novo: abre o cadastro com o telefone já validado (válido 30 min).
            $request->session()->put('verified_phone', ['phone' => $phone, 'at' => now()->timestamp]);

            return redirect()->route('register');
        }

        if ($user->isBlocked()) {
            throw ValidationException::withMessages(['code' => 'Este número está bloqueado. Contacte a administração.']);
        }

        Auth::login($user);
        $user->forceFill(['last_login_at' => now()])->saveQuietly();
        Audit::log('login', $user, null, null, 'Entrada com OTP');

        return $user->isStaff()
            ? redirect()->intended(route('dashboard'))
            : redirect()->route('profile.edit')->with('status', 'Bem-vindo(a)! Confirme se os seus dados estão actualizados.');
    }

    public function logout(Request $request): RedirectResponse
    {
        Audit::log('logout', $request->user());
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
