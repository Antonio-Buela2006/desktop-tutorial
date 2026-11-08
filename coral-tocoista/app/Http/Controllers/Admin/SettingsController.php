<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingsController extends Controller
{
    public function edit(): View
    {
        return view('admin.settings', [
            'settings' => collect(Setting::DEFAULTS)->map(fn ($v, $k) => Setting::get($k)),
            'lists' => LookupController::LISTS,
            'loginLink' => route('login'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'otp_validity_minutes' => ['required', 'integer', 'min:1', 'max:30'],
            'institution_name' => ['required', 'string', 'max:160'],
            'group_name' => ['required', 'string', 'max:160'],
        ], [], ['otp_validity_minutes' => 'validade do código', 'institution_name' => 'nome da instituição', 'group_name' => 'nome do grupo']);

        $old = [];
        $new = [];
        foreach ($data as $key => $value) {
            $current = Setting::get($key);
            if ((string) $current !== (string) $value) {
                $old[$key] = $current;
                $new[$key] = (string) $value;
                Setting::put($key, (string) $value);
            }
        }
        if ($new) {
            Audit::log('settings', null, $old, $new, 'Alteração de configurações');
        }

        return back()->with('status', 'Configurações gravadas.');
    }
}
