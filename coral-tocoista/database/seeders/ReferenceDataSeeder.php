<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Choir;
use App\Models\CulturalCategory;
use App\Models\CulturalGroup;
use App\Models\OrgUnit;
use App\Models\Parish;
use App\Models\Position;
use App\Models\Role;
use App\Models\Setting;
use App\Models\VoiceType;
use Illuminate\Database\Seeder;

/**
 * Dados de referência (idempotente: pode correr várias vezes).
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            [Role::ADMIN, 'Administrador Geral', 'Acesso total ao sistema.'],
            [Role::CHOIR_MANAGER, 'Responsável do Coro', 'Consulta membros, edita coristas, vê dashboard e relatórios.'],
            [Role::MEMBER, 'Corista/Membro', 'Vê e edita apenas a sua própria ficha.'],
        ] as [$slug, $name, $desc]) {
            Role::firstOrCreate(['slug' => $slug], ['name' => $name, 'description' => $desc]);
        }

        $group = CulturalGroup::firstOrCreate(['name' => 'Grupo Coral']);
        foreach (['Coro A', 'Coro B'] as $i => $name) {
            Choir::firstOrCreate(['cultural_group_id' => $group->id, 'name' => $name], ['sort' => $i + 1]);
        }

        foreach (['Área 1', 'Área 2', 'Área 3', 'Área 4', 'Outra'] as $i => $name) {
            Area::firstOrCreate(['name' => $name], ['sort' => $i + 1]);
        }

        // As paróquias reais são introduzidas pelo administrador em Configurações.
        Parish::firstOrCreate(['name' => 'Sede'], ['sort' => 1]);

        foreach (['Soprano', 'Contralto', 'Tenor', 'Barítono', 'Baixo'] as $i => $name) {
            VoiceType::firstOrCreate(['name' => $name], ['sort' => $i + 1]);
        }

        $categories = ['Corista', 'Cantor', 'Músico', 'Instrumentista', 'Autor', 'Escritor', 'Poeta',
            'Compositor', 'Artista Plástico', 'Pintor', 'Escultor', 'Actor', 'Dançarino', 'Coreógrafo',
            'Fotógrafo', 'Designer', 'Produtor Cultural', 'Artesão', 'Outro'];
        foreach ($categories as $i => $name) {
            CulturalCategory::firstOrCreate(['name' => $name],
                ['sort' => $i + 1, 'is_choir_member' => $name === 'Corista']);
        }

        // Organograma institucional
        $unit = fn (string $name, ?OrgUnit $parent, int $sort, bool $choirs = false) => OrgUnit::firstOrCreate(
            ['name' => $name], ['parent_id' => $parent?->id, 'sort' => $sort, 'shows_choirs' => $choirs]);

        $direccao = $unit('Direcção da Instituição', null, 1);
        $coordenacao = $unit('Coordenação Cultural', $direccao, 1);
        $responsavel = $unit('Responsável do Coro e Adjunto', $coordenacao, 1);
        $secretaria = $unit('Secretaria', $responsavel, 1);
        $musical = $unit('Direcção Musical', $responsavel, 2);
        $tesouraria = $unit('Tesouraria', $responsavel, 3);
        $banda = $unit('Banda', $responsavel, 4);
        $coristas = $unit('Coristas', $responsavel, 9, true);

        $positions = [
            ['Responsável do Coro', $responsavel, 'responsaveis', 1],
            ['Adjunto do Responsável do Coro', $responsavel, 'responsaveis', 2],
            ['Secretário', $secretaria, 'secretarios', 3],
            ['Secretário Adjunto', $secretaria, 'secretarios', 4],
            ['Mestre do Coro', $musical, 'mestres', 5],
            ['Mestre do Coro Adjunto', $musical, 'mestres', 6],
            ['Tesoureiro', $tesouraria, 'tesoureiros', 7],
            ['Responsável da Banda', $banda, 'banda', 8],
            ['Adjunto da Banda', $banda, 'banda', 9],
            ['Corista', $coristas, null, 10],
        ];
        foreach ($positions as [$name, $u, $group, $sort]) {
            Position::firstOrCreate(['name' => $name], [
                'org_unit_id' => $u->id, 'leadership_group' => $group,
                'is_leadership' => $group !== null, 'sort' => $sort,
            ]);
        }

        foreach (Setting::DEFAULTS as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
