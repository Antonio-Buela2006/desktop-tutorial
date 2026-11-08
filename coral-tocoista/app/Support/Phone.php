<?php

namespace App\Support;

/**
 * Telefones angolanos: +244 seguido de 9 dígitos a começar por 9.
 * Internamente guardamos só os 9 dígitos (ex.: 923456789).
 */
final class Phone
{
    public static function digits(?string $value): string
    {
        return preg_replace('/\D+/', '', (string) $value);
    }

    /** Normaliza "+244 923 456 789", "00244923456789", "923456789" -> "923456789" (ou null se inválido). */
    public static function normalize(?string $value): ?string
    {
        $d = self::digits($value);
        if (str_starts_with($d, '00244')) {
            $d = substr($d, 5);
        } elseif (str_starts_with($d, '244') && strlen($d) === 12) {
            $d = substr($d, 3);
        }

        return preg_match('/^9\d{8}$/', $d) ? $d : null;
    }

    public static function format(?string $nine): string
    {
        if (! $nine) {
            return '';
        }

        return '+244 '.substr($nine, 0, 3).' '.substr($nine, 3, 3).' '.substr($nine, 6);
    }

    /** Formato internacional sem "+", usado pela API do WhatsApp. */
    public static function international(string $nine): string
    {
        return '244'.$nine;
    }
}
