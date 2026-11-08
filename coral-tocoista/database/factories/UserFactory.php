<?php

namespace Database\Factories;

use App\Models\Area;
use App\Models\Choir;
use App\Models\Role;
use App\Models\User;
use App\Models\VoiceType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Membros FICTÍCIOS, apenas para testes e demonstração.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'phone' => '9'.$this->faker->unique()->numerify('########'),
            'sex' => $this->faker->randomElement(['M', 'F']),
            'birth_date' => $this->faker->dateTimeBetween('-70 years', '-14 years'),
            'marital_status' => $this->faker->randomElement(User::MARITAL_STATUSES),
            'address' => 'Bairro Fictício, Rua '.$this->faker->numberBetween(1, 99),
            'profession' => $this->faker->randomElement(['Professor', 'Enfermeira', 'Estudante', 'Motorista', 'Comerciante']),
            'baptized' => false,
            'area_id' => fn () => Area::query()->inRandomOrder()->value('id'),
            'is_choir_member' => false,
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (User $u) {
            $u->role_id ??= Role::idFor(Role::MEMBER);
            $u->consent_at ??= now();
        });
    }

    public function role(string $slug): static
    {
        return $this->afterMaking(fn (User $u) => $u->role_id = Role::idFor($slug));
    }

    public function admin(): static
    {
        return $this->role(Role::ADMIN);
    }

    public function choirManager(): static
    {
        return $this->role(Role::CHOIR_MANAGER);
    }

    public function chorister(?Choir $choir = null, ?VoiceType $voice = null): static
    {
        return $this->state(fn () => [
            'is_choir_member' => true,
            'choir_id' => $choir?->id ?? Choir::query()->inRandomOrder()->value('id'),
            'voice_type_id' => $voice?->id ?? VoiceType::query()->inRandomOrder()->value('id'),
            'choir_join_date' => $this->faker->dateTimeBetween('-15 years', '-1 month'),
        ]);
    }

    public function baptized(): static
    {
        return $this->state(fn () => ['baptized' => true, 'baptism_date' => $this->faker->dateTimeBetween('-40 years', '-1 year')]);
    }

    public function blocked(): static
    {
        return $this->afterMaking(fn (User $u) => $u->blocked_at = now());
    }
}
