import Alpine from 'alpinejs';

/** Cadastro/edição em passos, com campos condicionais. */
Alpine.data('memberForm', (initial = {}) => ({
    step: initial.step ?? 1,
    total: initial.total ?? 4,
    isChorister: !!initial.isChorister,
    baptized: !!initial.baptized,
    instrumentalist: !!initial.instrumentalist,
    preview: null,
    photoError: '',

    go(n) {
        if (n > this.step && !this.validate(this.step)) return;
        this.step = Math.min(Math.max(1, n), this.total);
        this.$nextTick(() => {
            this.$root.querySelector(`[data-step="${this.step}"] h2`)?.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    },

    /**
     * Valida os campos de um passo. Os campos condicionais escondidos ficam
     * "disabled" (não são validados nem enviados).
     */
    validate(s) {
        const section = this.$root.querySelector(`[data-step="${s}"]`);
        for (const el of section?.querySelectorAll('input, select, textarea') ?? []) {
            if (!el.disabled && !el.checkValidity()) {
                this.step = s;
                this.$nextTick(() => { el.focus(); el.reportValidity(); });
                return false;
            }
        }
        return true;
    },

    submit(e) {
        for (let s = 1; s <= this.total; s++) {
            if (!this.validate(s)) { e.preventDefault(); return; }
        }
    },

    photo(e) {
        const f = e.target.files[0];
        this.photoError = '';
        if (!f) { this.preview = null; return; }
        if (f.size > 2 * 1024 * 1024) {
            this.photoError = 'A fotografia não pode ter mais de 2 MB.';
            e.target.value = '';
            return;
        }
        this.preview = URL.createObjectURL(f);
    },
}));

/** Dashboard actualizado automaticamente. */
Alpine.data('liveStats', (url, initial) => ({
    s: initial,
    loading: false,
    init() {
        this.timer = setInterval(() => this.refresh(), 15000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
    },
    async refresh() {
        if (document.hidden) return;
        this.loading = true;
        try {
            const r = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
            if (r.ok) this.s = await r.json();
        } finally { this.loading = false; }
    },
    pct(n, max) { return max ? Math.round((n / max) * 100) : 0; },
    max(list, key = 'total') { return Math.max(1, ...list.map((i) => i[key])); },
}));

/** Contagem decrescente para "pedir novo código". */
Alpine.data('countdown', (seconds) => ({
    left: seconds,
    init() { this.t = setInterval(() => { if (this.left > 0) this.left--; }, 1000); },
}));

/** Copiar o link de acesso. */
Alpine.data('copyLink', () => ({
    copied: false,
    async copy(text) {
        try { await navigator.clipboard.writeText(text); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch { /* sem permissão */ }
    },
}));

window.Alpine = Alpine;
Alpine.start();
