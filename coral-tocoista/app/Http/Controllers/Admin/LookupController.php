<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\CulturalGroup;
use App\Models\Parish;
use App\Models\Position;
use App\Models\Role;
use App\Models\VoiceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

/**
 * Gestão genérica das listas parametrizáveis (só Administrador Geral).
 * Cada alteração é auditada pelo trait Auditable dos modelos.
 */
class LookupController extends Controller
{
    public const LISTS = [
        'areas' => ['label' => 'Áreas', 'model' => Area::class],
        'paroquias' => ['label' => 'Paróquias', 'model' => Parish::class],
        'vozes' => ['label' => 'Tipos de voz', 'model' => VoiceType::class],
        'categorias' => ['label' => 'Categorias culturais', 'model' => CulturalCategory::class],
        'coros' => ['label' => 'Coros', 'model' => Choir::class],
        'cargos' => ['label' => 'Cargos', 'model' => Position::class],
        'perfis' => ['label' => 'Perfis de acesso', 'model' => Role::class],
    ];

    private function def(string $list): array
    {
        abort_unless(isset(self::LISTS[$list]), 404);

        return self::LISTS[$list] + ['key' => $list];
    }

    public function index(string $list): View
    {
        $def = $this->def($list);
        $query = $def['model']::query();
        $table = (new $def['model'])->getTable();
        if (in_array($table, ['roles'])) {
            $query->orderBy('id');
        } else {
            $query->orderBy('sort')->orderBy('name');
        }
        if (method_exists($def['model'], 'users')) {
            $query->withCount('users');
        }

        return view('admin.lookups', ['def' => $def, 'items' => $query->get(), 'table' => $table,
            'leadershipGroups' => Position::LEADERSHIP_GROUPS]);
    }

    public function store(Request $request, string $list): RedirectResponse
    {
        $def = $this->def($list);
        abort_if($list === 'perfis', 403, 'Os perfis de acesso são fixos; pode apenas alterar o nome.');
        $model = new $def['model'];
        $model->fill($this->validated($request, $model));
        if ($model instanceof Choir) {
            $model->cultural_group_id = CulturalGroup::query()->value('id');
        }
        $model->save();

        return back()->with('status', 'Item adicionado.');
    }

    public function update(Request $request, string $list, int $id): RedirectResponse
    {
        $def = $this->def($list);
        $model = $def['model']::findOrFail($id);
        $model->fill($this->validated($request, $model))->save();

        return back()->with('status', 'Item actualizado.');
    }

    public function destroy(string $list, int $id): RedirectResponse
    {
        $def = $this->def($list);
        abort_if($list === 'perfis', 403);
        $model = $def['model']::findOrFail($id);
        if ($model instanceof CulturalCategory && $model->is_choir_member) {
            return back()->withErrors(['list' => 'A categoria "Corista" é usada automaticamente e não pode ser eliminada.']);
        }
        if (method_exists($model, 'users') && $model->users()->exists()) {
            return back()->withErrors(['list' => "\"{$model->name}\" está atribuído a membros. Desactive-o em vez de eliminar."]);
        }
        try {
            $model->delete();
        } catch (QueryException) {
            return back()->withErrors(['list' => 'Não é possível eliminar este item porque está em uso.']);
        }

        return back()->with('status', 'Item eliminado.');
    }

    private function validated(Request $request, Model $model): array
    {
        $table = $model->getTable();
        $rules = ['name' => ['required', 'string', 'max:120', Rule::unique($table, 'name')->ignore($model->getKey())]];

        if ($table === 'roles') {
            return $request->validate($rules + ['description' => ['nullable', 'string', 'max:255']]);
        }
        $rules['sort'] = ['nullable', 'integer', 'min:0', 'max:999'];
        if ($table === 'positions') {
            $rules['leadership_group'] = ['nullable', Rule::in(array_keys(Position::LEADERSHIP_GROUPS))];
            $data = $request->validate($rules);
            $data['is_leadership'] = ! empty($data['leadership_group']);

            return $data + ['sort' => 0];
        }
        $data = $request->validate($rules);
        $data['active'] = $request->boolean('active', true);
        $data['sort'] ??= 0;

        return $data;
    }
}
