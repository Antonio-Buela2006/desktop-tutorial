<?php

namespace App\Http\Controllers;

use App\Http\Requests\MemberRequest;
use App\Services\MemberService;
use App\Support\FormOptions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/** "Minha ficha": cada membro só vê e edita a sua própria ficha. */
class ProfileController extends Controller
{
    public function edit(Request $request): View
    {
        $member = $request->user()->load('culturalCategories', 'positions', 'role');

        return view('members.edit', FormOptions::member() + [
            'member' => $member,
            'action' => route('profile.update'),
            'own' => true,
        ]);
    }

    public function update(MemberRequest $request, MemberService $service): RedirectResponse
    {
        // Só campos da ficha: perfil, cargos e estado nunca chegam aqui (não estão em PROFILE_FIELDS).
        $service->update($request->user(), $request->validated(), $request->file('photo'), $request->boolean('remove_photo'));

        return redirect()->route('profile.edit')->with('status', 'Ficha actualizada com sucesso.');
    }
}
