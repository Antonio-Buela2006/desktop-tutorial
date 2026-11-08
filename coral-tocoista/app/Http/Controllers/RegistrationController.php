<?php

namespace App\Http\Controllers;

use App\Http\Requests\MemberRequest;
use App\Models\User;
use App\Services\MemberService;
use App\Support\Audit;
use App\Support\FormOptions;
use App\Support\Phone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

class RegistrationController extends Controller
{
    /** Tempo máximo entre validar o OTP e concluir o cadastro. */
    private const VERIFIED_TTL_SECONDS = 1800;

    public function create(Request $request): View|RedirectResponse
    {
        $phone = $this->verifiedPhone($request);
        if (! $phone) {
            return redirect()->route('login')->withErrors(['phone' => 'Valide primeiro o seu número de telefone.']);
        }

        return view('members.register', FormOptions::member() + [
            'member' => new User(['area_id' => null]),
            'phone' => Phone::format($phone),
        ]);
    }

    public function store(MemberRequest $request, MemberService $service): RedirectResponse
    {
        $phone = $this->verifiedPhone($request);
        if (! $phone) {
            return redirect()->route('login')->withErrors(['phone' => 'A validação do número expirou. Peça um novo código.']);
        }

        $user = $service->register($phone, $request->validated(), $request->file('photo'));

        $request->session()->forget('verified_phone');
        $request->session()->regenerate();
        Auth::login($user);
        $user->forceFill(['last_login_at' => now()])->saveQuietly();
        Audit::log('login', $user, null, null, 'Primeira entrada após cadastro');

        return redirect()->route($user->isStaff() ? 'dashboard' : 'profile.edit')
            ->with('status', $user->isAdmin()
                ? 'Cadastro concluído. Como primeiro utilizador, ficou como Administrador Geral.'
                : 'Cadastro concluído com sucesso. Bem-vindo(a)!');
    }

    private function verifiedPhone(Request $request): ?string
    {
        $v = $request->session()->get('verified_phone');
        if (! $v || now()->timestamp - $v['at'] > self::VERIFIED_TTL_SECONDS) {
            return null;
        }

        // Se entretanto o número foi cadastrado (ex.: noutro separador), não abre novo cadastro.
        return User::where('phone', $v['phone'])->exists() ? null : $v['phone'];
    }
}
