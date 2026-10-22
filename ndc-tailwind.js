// Tailwind CDN theme for the portfolio shell — NDC Product Standard.
// Declarations: Orange · Restrained · Red Hat Display (see DESIGN.md).
// Load immediately after cdn.tailwindcss.com. Every gray/white utility in the
// pages resolves to the shared ink ramp and the Orange-derived surfaces, so no
// utility class can reach a pure #FFFFFF or #000000.
if (window.tailwind) tailwind.config = {
  theme: {
    extend: {
      colors: {
        white: '#FEFAF7',          // card — ΔE 2.32 from pure white
        black: '#07212F',          // ink 1°
        gray: {
          50:  '#FAEEEA',          // raised
          100: '#FAEEEA',          // raised
          200: '#D3D4D6',          // hairline
          300: '#D3D4D6',          // hairline
          400: '#857E79',          // control border (≥3.5:1 on every surface)
          500: '#544F4C',          // ink 3°
          600: '#544F4C',          // ink 3°
          700: '#373C3B',          // ink 2°
          800: '#26272B',          // ink 1° alt
          900: '#07212F',          // ink 1°
        },
        accent: {
          DEFAULT: '#B84307',      // action tone (hand-tuned; 5.15:1 on ground)
          pressed: '#9E3906',      // text on the Orange wash (5.88:1)
          fill:    '#F66C27',      // fill tone — surfaces only, never text
          wash:    '#FCE9E0',      // fill @10% over ground
        },
        // Functional colours: YouTube and App Store status only.
        red:   { 50: '#FEF2F2', 600: '#B91C1C', 700: '#991B1B', 800: '#7F1D1D' },
        green: { 50: '#F0FDF4', 500: '#15803D', 600: '#15803D', 700: '#166534' },
      },
      fontFamily: {
        sans:    ['"Red Hat Text"', 'system-ui', 'sans-serif'],
        display: ['"Red Hat Display"', '"Red Hat Text"', 'sans-serif'],
        mono:    ['"Red Hat Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',            // tags, chips
        md:  '8px',                // fields, small buttons
        lg:  '8px',
        xl:  '12px',               // buttons, rows
        '2xl': '16px',             // cards, tiles
        '3xl': '28px',             // features
      },
      boxShadow: {
        // Tinted to the Orange ground, never neutral grey.
        // Resting card: a 1px tinted edge does the separating (card is ΔE 1.09 from ground).
        sm:  '0 0 0 1px rgb(74 38 18 / 0.08), 0 1px 2px 0 rgb(74 38 18 / 0.06)',
        DEFAULT: '0 1px 3px 0 rgb(74 38 18 / 0.08), 0 1px 2px -1px rgb(74 38 18 / 0.08)',
        lg:  '0 10px 15px -3px rgb(74 38 18 / 0.10), 0 4px 6px -4px rgb(74 38 18 / 0.08)',
      },
      dropShadow: {
        lg: ['0 10px 8px rgb(74 38 18 / 0.06)', '0 4px 3px rgb(74 38 18 / 0.10)'],
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
};
