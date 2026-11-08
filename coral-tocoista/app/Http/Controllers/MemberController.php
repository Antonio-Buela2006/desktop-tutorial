<?php

namespace App\Http\Controllers;

use App\Http\Requests\MemberRequest;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\MemberService;
use App\Support\FormOptions;
use App\Support\Phone;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\Response;

class MemberController extends Controller
{
    public function __construct(private MemberService $service) {}

    public function index(Request $request): View
    {
        Gate::authorize('viewAny', User::class);
        $filters = $request->only(['q', 'parish_id', 'area_id', 'choir_id', 'voice_type_id', 'position_id', 'category_id', 'role_id', 'state']);

        $members = User::query()
            ->with(['area:id,name', 'choir:id,name', 'voiceType:id,name', 'role:id,name,slug'])
            ->filter($filters)
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return view('members.index', FormOptions::filters() + compact('members', 'filters'));
    }

    public function show(User $user): View
    {
        Gate::authorize('view', $user);
        $user->load('area', 'parish', 'choir', 'voiceType', 'role', 'positions', 'culturalCategories');

        return view('members.show', [
            'member' => $user,
            'roles' => Role::orderBy('id')->get(),
            'positions' => Position::orderBy('sort')->get(),
        ]);
    }

    public function edit(User $user): View
    {
        Gate::authorize('update', $user);
        $user->load('culturalCategories');

        return view('members.edit', FormOptions::member() + [
            'member' => $user,
            'action' => route('members.update', $user),
            'own' => false,
        ]);
    }

    public function update(MemberRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);
        $this->service->update($user, $request->validated(), $request->file('photo'), $request->boolean('remove_photo'));

        return redirect()->route('members.show', $user)->with('status', 'Ficha actualizada.');
    }

    /** Perfil de acesso e cargos — só o Administrador Geral. */
    public function updateAccess(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('manageAccess', $user);
        $data = $request->validate([
            'role_id' => ['nullable', Rule::exists('roles', 'id')],
            'positions' => ['nullable', 'array'],
            'positions.*' => ['integer', Rule::exists('positions', 'id')],
        ]);

        if (isset($data['role_id']) && (int) $data['role_id'] !== $user->role_id) {
            Gate::authorize('changeRole', $user);
            $this->service->setRole($user, (int) $data['role_id']);
        }
        $this->service->syncPositions($user, $data['positions'] ?? []);

        return back()->with('status', 'Perfil e cargos actualizados.');
    }

    public function block(User $user): RedirectResponse
    {
        Gate::authorize('block', $user);
        $this->service->setBlocked($user, true);

        return back()->with('status', "{$user->name} foi bloqueado(a).");
    }

    public function unblock(User $user): RedirectResponse
    {
        Gate::authorize('block', $user);
        $this->service->setBlocked($user, false);

        return back()->with('status', "{$user->name} foi desbloqueado(a).");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('delete', $user);
        // Confirmação: o administrador tem de escrever o número de telefone do membro.
        $request->validate(['confirm_phone' => ['required', 'string']], [
            'confirm_phone.required' => 'Para confirmar, escreva o telefone do membro.',
        ]);
        if (Phone::normalize($request->input('confirm_phone')) !== $user->phone) {
            return back()->withErrors(['confirm_phone' => 'O telefone escrito não corresponde. O membro NÃO foi eliminado.']);
        }
        $name = $user->name;
        $this->service->delete($user);

        return redirect()->route('members.index')->with('status', "{$name} foi eliminado(a).");
    }

    /** A fotografia fica em disco privado e só é servida a quem pode ver a ficha. */
    public function photo(User $user): Response
    {
        Gate::authorize('view', $user);
        abort_unless($user->photo_path && Storage::disk('local')->exists($user->photo_path), 404);

        return Storage::disk('local')->response($user->photo_path, null, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
