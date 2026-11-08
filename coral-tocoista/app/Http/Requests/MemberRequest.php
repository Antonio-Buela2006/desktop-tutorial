<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Support\Phone;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validação da ficha do membro (cadastro e edição).
 * Regras de negócio:
 *  - obrigatórios sempre: nome, telefone (já validado por OTP) e área;
 *  - coro, tipo de voz e data de ingresso: obrigatórios SÓ se for corista;
 *  - consentimento obrigatório no primeiro cadastro.
 */
class MemberRequest extends FormRequest
{
    public const DATE_FIELDS = ['birth_date', 'church_admission_date', 'baptism_date', 'choir_join_date'];

    public function authorize(): bool
    {
        return true; // a autorização é feita no controller/Policy
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        // Aceita datas em dd/mm/aaaa (escritas à mão) e aaaa-mm-dd (input date do browser).
        foreach (self::DATE_FIELDS as $f) {
            $v = trim((string) $this->input($f));
            if (preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $v, $m)) {
                $merge[$f] = checkdate((int) $m[2], (int) $m[1], (int) $m[3]) ? "{$m[3]}-{$m[2]}-{$m[1]}" : $v;
            }
        }
        if ($this->filled('phone_alt')) {
            $merge['phone_alt'] = Phone::normalize($this->input('phone_alt')) ?? $this->input('phone_alt');
        }
        foreach (['baptized', 'is_choir_member', 'is_instrumentalist'] as $b) {
            $merge[$b] = $this->boolean($b);
        }
        $merge['name'] = preg_replace('/\s+/', ' ', trim((string) $this->input('name')));
        $this->merge($merge);
    }

    public function rules(): array
    {
        $today = Carbon::today()->format('Y-m-d');
        $active = fn (string $table) => Rule::exists($table, 'id')->where('active', true);

        $rules = [
            'name' => ['required', 'string', 'min:3', 'max:160'],
            'photo' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=8000,max_height=8000'],
            'remove_photo' => ['nullable', 'boolean'],
            'sex' => ['nullable', Rule::in(['M', 'F'])],
            'birth_date' => ['nullable', 'date_format:Y-m-d', 'after:1900-01-01', "before_or_equal:{$today}"],
            'marital_status' => ['nullable', Rule::in(User::MARITAL_STATUSES)],
            'phone_alt' => ['nullable', 'regex:/^9\d{8}$/'],
            'email' => ['nullable', 'email:rfc', 'max:160'],
            'address' => ['nullable', 'string', 'max:255'],
            'profession' => ['nullable', 'string', 'max:120'],
            'education' => ['nullable', 'string', 'max:120'],

            'church_admission_date' => ['nullable', 'date_format:Y-m-d', "before_or_equal:{$today}"],
            'baptized' => ['boolean'],
            'baptism_date' => ['nullable', 'exclude_unless:baptized,true', 'date_format:Y-m-d', "before_or_equal:{$today}"],
            'parish_id' => ['nullable', $active('parishes')],
            'area_id' => ['required', $active('areas')],

            'is_choir_member' => ['boolean'],
            'choir_id' => ['exclude_unless:is_choir_member,true', 'required', $active('choirs')],
            'voice_type_id' => ['exclude_unless:is_choir_member,true', 'required', $active('voice_types')],
            'choir_join_date' => ['exclude_unless:is_choir_member,true', 'required', 'date_format:Y-m-d', "before_or_equal:{$today}"],
            'is_instrumentalist' => ['boolean'],
            'instrument' => ['nullable', 'exclude_unless:is_instrumentalist,true', 'string', 'max:120'],

            'categories' => ['nullable', 'array'],
            'categories.*' => ['integer', $active('cultural_categories')],
        ];

        if ($this->isRegistration()) {
            $rules['consent'] = ['accepted'];
        }

        return $rules;
    }

    public function isRegistration(): bool
    {
        return $this->routeIs('register.store');
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Indique o nome completo.',
            'area_id.required' => 'Escolha a sua área.',
            'choir_id.required' => 'Como é corista, escolha o coro.',
            'voice_type_id.required' => 'Como é corista, escolha o tipo de voz.',
            'choir_join_date.required' => 'Como é corista, indique a data de ingresso no coro.',
            'consent.accepted' => 'Para concluir o cadastro tem de autorizar o tratamento dos seus dados.',
            'phone_alt.regex' => 'O telefone alternativo deve ter 9 dígitos e começar por 9.',
            'photo.max' => 'A fotografia não pode ter mais de 2 MB.',
            'photo.image' => 'A fotografia tem de ser uma imagem (JPG, PNG ou WEBP).',
            'photo.mimes' => 'A fotografia tem de ser JPG, PNG ou WEBP.',
            '*.date_format' => 'Data inválida. Use o formato dd/mm/aaaa.',
            '*.before_or_equal' => 'A data não pode ser no futuro.',
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nome completo', 'birth_date' => 'data de nascimento', 'email' => 'e-mail',
            'church_admission_date' => 'data de admissão', 'baptism_date' => 'data de baptismo',
            'area_id' => 'área', 'parish_id' => 'paróquia', 'choir_id' => 'coro', 'voice_type_id' => 'tipo de voz',
            'choir_join_date' => 'data de ingresso no coro', 'instrument' => 'instrumento', 'photo' => 'fotografia',
        ];
    }
}
